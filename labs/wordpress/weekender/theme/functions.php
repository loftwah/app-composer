<?php
// Load this fixture's own styles through the ordinary WordPress theme hook.
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('macedon-weekender-lab', get_stylesheet_uri(), [], '1.0.0');
});
