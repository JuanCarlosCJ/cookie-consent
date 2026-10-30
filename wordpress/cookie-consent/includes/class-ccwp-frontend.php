<?php
/**
 * Front end: prints the script as the very first thing in <head>, and the [cookie_settings] shortcode.
 */

defined( 'ABSPATH' ) || exit;

final class CCWP_Frontend {

	public static function init(): void {
		// Priority -1000: before any other plugin or theme adds its scripts to wp_head.
		add_action( 'wp_head', array( __CLASS__, 'print_script' ), -1000 );
		add_shortcode( 'cookie_settings', array( __CLASS__, 'shortcode' ) );
	}

	public static function print_script(): void {
		$options = CCWP_Options::get();
		if ( empty( $options['enabled'] ) || is_customize_preview() ) {
			return;
		}

		$config = wp_json_encode( CCWP_Options::script_config(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		// data-cc-ignore: our own tags must never be blocked by the script itself.
		wp_print_inline_script_tag( 'window.cookieConsentConfig = ' . $config . ';', array( 'data-cc-ignore' => true ) );
		// Loaded normally (not async or defer) on purpose: it has to run before anything else.
		wp_print_script_tag(
			array(
				'src'            => add_query_arg( 'ver', CCWP_VERSION, CCWP_URL . 'assets/cookie-consent.min.js' ),
				'data-cc-ignore' => true,
			)
		);
	}

	/**
	 * [cookie_settings] or [cookie_settings text="Change cookies"]: a link that opens the settings.
	 *
	 * @param array|string $atts Shortcode attributes.
	 */
	public static function shortcode( $atts ): string {
		$atts = shortcode_atts(
			array( 'text' => __( 'Cookie settings', 'cookie-consent' ) ),
			$atts,
			'cookie_settings'
		);
		return sprintf(
			'<a href="#" class="ccwp-settings-link" data-cc-open role="button">%s</a>',
			esc_html( $atts['text'] )
		);
	}
}
