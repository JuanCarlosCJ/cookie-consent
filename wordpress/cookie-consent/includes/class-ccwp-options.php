<?php
/**
 * Settings: defaults, cleaning what comes from the form, and turning them into the script's config.
 */

defined( 'ABSPATH' ) || exit;

final class CCWP_Options {

	const CATEGORIES = array( 'analytics', 'marketing', 'media' );
	const POSITIONS  = array( 'bar', 'box', 'center' );
	const LANGS      = array( 'en', 'es' );
	const TEXT_KEYS  = array( 'title', 'message' );

	public static function defaults(): array {
		return array(
			'enabled'        => true,
			'categories'     => self::CATEGORIES,
			'position'       => 'bar',
			'floating'       => true,
			'accent'         => '#2563eb',
			'policy_page'    => 0,
			'revision'       => 1,
			'consent_mode'   => false,
			'rewrite'        => true,
			'expires_days'   => 365,
			'rules_text'     => '',
			'texts'          => array(
				'en' => array( 'title' => '', 'message' => '' ),
				'es' => array( 'title' => '', 'message' => '' ),
			),
		);
	}

	/**
	 * Registered on every request (not only in wp-admin), so the option is cleaned however it's saved:
	 * the settings page, WP-CLI, the REST API or another plugin.
	 */
	public static function register(): void {
		register_setting(
			'ccwp',
			CCWP_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => self::defaults(),
			)
		);
	}

	/** The saved settings, checked again on the way out in case the database holds something odd. */
	public static function get(): array {
		$saved = get_option( CCWP_OPTION, null );
		return is_array( $saved ) ? self::clean( $saved, 1 ) : self::defaults();
	}

	/**
	 * Sanitize callback for the option. WordPress has already removed slashes from the form data.
	 * Note: WordPress can call this twice when the option is first created, so it must give the
	 * same result when run on its own output.
	 *
	 * @param mixed $input Form data, or the value passed to update_option().
	 */
	public static function sanitize( $input ): array {
		$input       = is_array( $input ) ? $input : array();
		$current     = get_option( CCWP_OPTION, null );
		$current_rev = is_array( $current ) && isset( $current['revision'] ) ? absint( $current['revision'] ) : 1;

		$out = self::clean( $input, $current_rev );
		// "Ask everyone again": a new revision makes every stored choice invalid.
		if ( ! empty( $input['ask_again'] ) ) {
			++$out['revision'];
		}
		return $out;
	}

	/**
	 * Checks every value against a list of allowed values.
	 *
	 * @param array $input        Values to check.
	 * @param int   $revision_min The revision can only go up.
	 */
	private static function clean( array $input, int $revision_min ): array {
		$out = self::defaults();

		$out['revision'] = max( 1, $revision_min, isset( $input['revision'] ) ? absint( $input['revision'] ) : 0 );

		$out['enabled']      = ! empty( $input['enabled'] );
		$out['floating']     = ! empty( $input['floating'] );
		$out['consent_mode'] = ! empty( $input['consent_mode'] );
		// On unless explicitly switched off (the form always sends 0 or 1; older saved settings don't have it).
		$out['rewrite']      = ! array_key_exists( 'rewrite', $input ) || ! empty( $input['rewrite'] );

		$cats              = isset( $input['categories'] ) && is_array( $input['categories'] ) ? $input['categories'] : array();
		$out['categories'] = array_values( array_intersect( self::CATEGORIES, array_map( 'strval', $cats ) ) );

		$position        = isset( $input['position'] ) ? (string) $input['position'] : '';
		$out['position'] = in_array( $position, self::POSITIONS, true ) ? $position : 'bar';

		$accent        = isset( $input['accent'] ) ? sanitize_hex_color( (string) $input['accent'] ) : '';
		$out['accent'] = $accent ? $accent : '#2563eb';

		$out['policy_page']  = isset( $input['policy_page'] ) ? absint( $input['policy_page'] ) : 0;
		$days                = isset( $input['expires_days'] ) ? absint( $input['expires_days'] ) : 365;
		$out['expires_days'] = min( 730, max( 1, $days ) );

		$out['rules_text'] = isset( $input['rules_text'] ) ? sanitize_textarea_field( (string) $input['rules_text'] ) : '';

		foreach ( self::LANGS as $lang ) {
			foreach ( self::TEXT_KEYS as $key ) {
				$value                       = isset( $input['texts'][ $lang ][ $key ] ) ? (string) $input['texts'][ $lang ][ $key ] : '';
				$out['texts'][ $lang ][ $key ] = 'message' === $key ? sanitize_textarea_field( $value ) : sanitize_text_field( $value );
			}
		}

		return $out;
	}

	/**
	 * Reads the owner's rules, one per line: "category: pattern" or "category: pattern: name".
	 * Lines starting with # are comments.
	 *
	 * @return array<int, array{category: string, pattern: string, name: string}>
	 */
	public static function parse_rules( string $text ): array {
		$rules   = array();
		$allowed = array_merge( array( 'necessary' ), self::CATEGORIES );
		foreach ( preg_split( '/\R/', $text ) as $line ) {
			$line = trim( $line );
			if ( '' === $line || '#' === $line[0] ) {
				continue;
			}
			$parts = array_map( 'trim', explode( ':', $line, 2 ) );
			if ( count( $parts ) < 2 || ! in_array( strtolower( $parts[0] ), $allowed, true ) ) {
				continue;
			}
			$pattern = $parts[1];
			$name    = '';
			// An optional name after " : " at the end, e.g. "analytics: plausible.io : Plausible".
			if ( preg_match( '/^(.*\S)\s+:\s+(.+)$/', $pattern, $m ) ) {
				$pattern = $m[1];
				$name    = $m[2];
			}
			if ( '' !== $pattern ) {
				$rules[] = array(
					'category' => strtolower( $parts[0] ),
					'pattern'  => $pattern,
					'name'     => '' !== $name ? $name : $pattern,
				);
			}
		}
		return $rules;
	}

	/** The site language as the script understands it. */
	public static function lang(): string {
		return 0 === strpos( determine_locale(), 'es' ) ? 'es' : 'en';
	}

	/** Everything the script needs, ready to print as JSON. */
	public static function script_config(): array {
		$o    = self::get();
		$lang = self::lang();

		$config = array(
			'lang'              => $lang,
			'categories'        => $o['categories'],
			'position'          => $o['position'],
			'floatingButton'    => (bool) $o['floating'],
			'accent'            => $o['accent'],
			'revision'          => (int) $o['revision'],
			'googleConsentMode' => (bool) $o['consent_mode'],
			'expiresDays'       => (int) $o['expires_days'],
			'rules'             => self::parse_rules( $o['rules_text'] ),
		);

		$policy = $o['policy_page'] ? get_permalink( $o['policy_page'] ) : '';
		if ( $policy ) {
			$config['policyUrl'] = $policy;
		}

		$texts = array_filter( $o['texts'][ $lang ] ?? array() );
		if ( $texts ) {
			$config['texts'] = array( $lang => $texts );
		}

		/**
		 * Filters the configuration passed to the cookie consent script.
		 *
		 * @param array $config Script configuration.
		 */
		return apply_filters( 'ccwp_script_config', $config );
	}
}
