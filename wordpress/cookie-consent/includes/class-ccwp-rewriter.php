<?php
/**
 * Holds trackers back on the server, before the page reaches the browser.
 *
 * The script alone can stop trackers from running, but browsers start downloading
 * scripts and loading iframes from the HTML before any JavaScript can step in. So the
 * plugin rewrites them in the page itself:
 *  - <script src="tracker"> and tracker snippets become type="text/plain" data-cc-category="...",
 *    which browsers neither download nor run;
 *  - <iframe src="embed"> keeps its address in data-cc-src instead of src.
 * The script releases them when the visitor allows their category. The page is the same
 * for every visitor, so it works with page caching.
 */

defined( 'ABSPATH' ) || exit;

final class CCWP_Rewriter {

	/** @var array<int, array{name: string, category: string, on: string, test: callable}>|null */
	private static $rules = null;

	public static function init(): void {
		add_action( 'template_redirect', array( __CLASS__, 'start' ), 0 );
	}

	public static function start(): void {
		$options = CCWP_Options::get();
		if ( empty( $options['enabled'] ) || empty( $options['rewrite'] ) || is_admin() || is_feed() || is_embed()
			|| is_customize_preview() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}
		ob_start( array( __CLASS__, 'rewrite' ) );
	}

	/** Output buffer callback: rewrites every script and iframe that belongs to an optional category. */
	public static function rewrite( string $html ): string {
		if ( false === stripos( $html, '<html' ) ) {
			return $html; // not a full page (JSON, XML...)
		}
		$html = preg_replace_callback( '#<script\b([^>]*)>(.*?)</script>#is', array( __CLASS__, 'script' ), $html );
		$html = preg_replace_callback( '#<iframe\b([^>]*)>#i', array( __CLASS__, 'iframe' ), $html );
		return is_string( $html ) ? $html : '';
	}

	/** @param array{0: string, 1: string, 2: string} $m */
	private static function script( array $m ): string {
		$attrs = $m[1];
		if ( preg_match( '#\bdata-cc-(ignore|category)\b#i', $attrs ) ) {
			return $m[0];
		}
		$type = self::attr( $attrs, 'type' );
		if ( null !== $type && ! in_array( strtolower( trim( $type ) ), array( '', 'text/javascript', 'application/javascript', 'module', 'text/ecmascript' ), true ) ) {
			return $m[0]; // JSON, templates, import maps...
		}
		$src  = self::attr( $attrs, 'src' );
		$rule = null !== $src ? self::match( html_entity_decode( $src ), 'url' ) : self::match( $m[2], 'inline' );
		if ( ! $rule ) {
			return $m[0];
		}

		$attrs = self::remove_attr( $attrs, 'type' );
		$extra = ' type="text/plain" data-cc-category="' . esc_attr( $rule['category'] ) . '" data-cc-service="' . esc_attr( $rule['name'] ) . '"';
		if ( null !== $type && '' !== trim( $type ) ) {
			$extra .= ' data-cc-type="' . esc_attr( trim( $type ) ) . '"';
		}
		return '<script' . $attrs . $extra . '>' . $m[2] . '</script>';
	}

	/** @param array{0: string, 1: string} $m */
	private static function iframe( array $m ): string {
		$attrs = $m[1];
		if ( preg_match( '#\bdata-cc-(ignore|src)\b#i', $attrs ) ) {
			return $m[0];
		}
		$src = self::attr( $attrs, 'src' );
		if ( null === $src ) {
			return $m[0];
		}
		$rule = self::match( html_entity_decode( $src ), 'url' );
		if ( ! $rule ) {
			return $m[0];
		}
		$attrs = self::remove_attr( $attrs, 'src' );
		return '<iframe' . $attrs . ' data-cc-src="' . esc_attr( html_entity_decode( $src ) ) . '" data-cc-category="' . esc_attr( $rule['category'] ) . '" data-cc-service="' . esc_attr( $rule['name'] ) . '">';
	}

	/** First rule that matches, owner rules first. Rules for "necessary" mean "leave it alone". */
	private static function match( string $text, string $kind ): ?array {
		if ( '' === trim( $text ) ) {
			return null;
		}
		foreach ( self::rules() as $rule ) {
			if ( ( 'both' === $rule['on'] || $kind === $rule['on'] ) && ( $rule['test'] )( $text ) ) {
				return 'necessary' === $rule['category'] ? null : $rule;
			}
		}
		return null;
	}

	/** The owner's rules, then the built-in ones from assets/rules.json (generated from the script's source). */
	private static function rules(): array {
		if ( null !== self::$rules ) {
			return self::$rules;
		}
		$raw  = array();
		foreach ( CCWP_Options::parse_rules( CCWP_Options::get()['rules_text'] ) as $r ) {
			$p = $r['pattern'];
			if ( preg_match( '#^/(.+)/([a-z]*)$#', $p, $re ) ) {
				$raw[] = array( 'name' => $r['name'], 'category' => $r['category'], 'on' => 'both', 'regex' => $re[1], 'flags' => $re[2] );
			} else {
				$raw[] = array( 'name' => $r['name'], 'category' => $r['category'], 'on' => 'both', 'contains' => $p );
			}
		}
		$json  = file_get_contents( CCWP_DIR . 'assets/rules.json' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local plugin file.
		$known = $json ? json_decode( $json, true ) : array();
		$raw   = array_merge( $raw, is_array( $known ) ? $known : array() );

		self::$rules = array();
		foreach ( $raw as $r ) {
			if ( isset( $r['contains'] ) && '' !== $r['contains'] ) {
				$needle = (string) $r['contains'];
				$test   = static function ( string $text ) use ( $needle ): bool {
					return false !== strpos( $text, $needle );
				};
			} elseif ( isset( $r['regex'] ) ) {
				// JavaScript and PCRE regexes are close enough for these patterns; only i/m/s/u flags carry over.
				$pattern = '#' . str_replace( '#', '\#', (string) $r['regex'] ) . '#' . preg_replace( '/[^imsu]/', '', (string) ( $r['flags'] ?? '' ) );
				if ( false === @preg_match( $pattern, '' ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- an invalid owner regex is simply skipped.
					continue;
				}
				$test = static function ( string $text ) use ( $pattern ): bool {
					return 1 === preg_match( $pattern, $text );
				};
			} else {
				continue;
			}
			self::$rules[] = array(
				'name'     => (string) $r['name'],
				'category' => (string) $r['category'],
				'on'       => in_array( $r['on'] ?? 'both', array( 'url', 'inline', 'both' ), true ) ? $r['on'] : 'both',
				'test'     => $test,
			);
		}
		return self::$rules;
	}

	/** Value of an HTML attribute, or null if it isn't there. */
	private static function attr( string $attrs, string $name ): ?string {
		if ( preg_match( '#(?:^|\s)' . $name . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))#i', $attrs, $m ) ) {
			return $m[1] . ( $m[2] ?? '' ) . ( $m[3] ?? '' );
		}
		return preg_match( '#(?:^|\s)' . $name . '(?=\s|$)#i', $attrs ) ? '' : null;
	}

	private static function remove_attr( string $attrs, string $name ): string {
		return (string) preg_replace( '#\s' . $name . '(\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+))?(?=\s|/?$)#i', '', $attrs );
	}
}
