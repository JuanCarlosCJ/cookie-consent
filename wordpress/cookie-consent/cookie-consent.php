<?php
/**
 * Plugin Name:       Cookie Consent
 * Plugin URI:        https://github.com/JuanCarlosCJ/cookie-consent
 * Description:       A light cookie banner that really blocks Google Analytics, Meta Pixel, YouTube and other trackers until visitors agree. Reject is as easy as Accept.
 * Version:           1.0.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Juan Carlos
 * Author URI:        https://juancarloscj.com
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       cookie-consent
 * Domain Path:       /languages
 */

defined( 'ABSPATH' ) || exit;

define( 'CCWP_VERSION', '1.0.0' );
define( 'CCWP_FILE', __FILE__ );
define( 'CCWP_DIR', plugin_dir_path( __FILE__ ) );
define( 'CCWP_URL', plugin_dir_url( __FILE__ ) );
define( 'CCWP_OPTION', 'ccwp_settings' );

require_once CCWP_DIR . 'includes/class-ccwp-options.php';
require_once CCWP_DIR . 'includes/class-ccwp-frontend.php';
require_once CCWP_DIR . 'includes/class-ccwp-rewriter.php';

add_action(
	'init',
	static function () {
		load_plugin_textdomain( 'cookie-consent', false, dirname( plugin_basename( CCWP_FILE ) ) . '/languages' );
	}
);

add_action( 'init', array( 'CCWP_Options', 'register' ) );
CCWP_Frontend::init();
CCWP_Rewriter::init();

if ( is_admin() ) {
	require_once CCWP_DIR . 'includes/class-ccwp-admin.php';
	CCWP_Admin::init();
}
