<?php
/**
 * Removes the plugin's settings when it is deleted from the Plugins screen.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'ccwp_settings' );
