<?php
// Fictional source seeding through WordPress APIs. Never used to seed EmDash.
if (!defined('WP_CLI') || !WP_CLI) {
    throw new RuntimeException('Run only inside the selected lab WordPress CLI.');
}
$origin = get_option('siteurl');
if (!preg_match('~^https?://(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$|^https://[a-z0-9-]+\.trycloudflare\.com$~', $origin)) {
    WP_CLI::error('The fictional lab refuses an unrelated WordPress origin.');
}
$fixture = json_decode(file_get_contents('/fixture/stories.json'), true, 32, JSON_THROW_ON_ERROR);
$scenario = $args[0] ?? 'small';
if (!in_array($scenario, ['small', 'publisher'], true)) {
    WP_CLI::error('Select the small or complete publisher source fixture.');
}
if ($scenario === 'publisher') {
    require '/fixture/complete/fixture.php';
}
if (($fixture['fictional'] ?? false) !== true || get_option('blogname') !== 'Macedon Weekender — fictional lab') {
    WP_CLI::error('Select the fictional Weekender installation.');
}
if (get_option('composer_weekender_fixture')) {
    WP_CLI::error('This source is already seeded. Use read-only snapshot or create a fresh run; existing work is never reseeded.');
}
$owner = get_user_by('login', 'fictional-editor');
if (!$owner || !user_can($owner, 'manage_options')) {
    WP_CLI::error('Select the fictional source administrator.');
}
wp_set_current_user($owner->ID);
require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';

function weekender_result($value) {
    if (is_wp_error($value)) {
        WP_CLI::error($value);
    }
    return $value;
}

update_option('blogdescription', 'Walks, good tables and field notes. Fictional content for an App Composer migration lab.');
update_option('timezone_string', 'Australia/Melbourne');
global $wp_rewrite;
$wp_rewrite->set_permalink_structure('/%year%/%monthnum%/%postname%/');
$wp_rewrite->init();
update_option('blog_public', 0);
update_option('comment_registration', 1);

// Only a new installation's standard examples may be removed. The marker above
// refuses every subsequent seed before any options, records or media are changed.
$examples = get_posts([
    'post_type' => ['post', 'page'],
    'post_status' => 'any',
    'numberposts' => -1,
]);
foreach ($examples as $post) {
    if (!in_array($post->post_name, ['hello-world', 'sample-page', 'privacy-policy'], true)) {
        WP_CLI::error('Existing non-fixture content is protected.');
    }
}
foreach ($examples as $post) {
    wp_delete_post($post->ID, true);
}

$authors = [];
foreach ($fixture['authors'] as $person) {
    $authors[$person['login']] = weekender_result(wp_insert_user([
        'user_login' => $person['login'],
        'user_pass' => wp_generate_password(40),
        'user_email' => $person['login'] . '@example.test',
        'display_name' => $person['name'],
        'role' => 'author',
    ]));
}
$terms = [];
foreach (['Field notes', 'At the table', 'Walks'] as $name) {
    $term = term_exists($name, 'category');
    if (!$term) {
        $term = weekender_result(wp_insert_term($name, 'category'));
    }
    $terms[$name] = (int) $term['term_id'];
}
weekender_result(wp_update_term($terms['Walks'], 'category', [
    'parent' => $terms['Field notes'],
]));

// The pinned official WordPress theme supplies these non-personal photographs.
$media = json_decode(file_get_contents('/fixture/media.json'), true, 16, JSON_THROW_ON_ERROR);
$attachmentIds = [];
$imageSources = [];
foreach ($media as $item) {
    $source = ABSPATH . 'wp-content/themes/twentytwentyfive/assets/images/' . $item['file'];
    if (!is_file($source) || hash_file('sha256', $source) !== $item['sha256']) {
        WP_CLI::error('The pinned non-personal source image changed. Review it before continuing.');
    }
}
foreach ($media as $index => $item) {
    $source = ABSPATH . 'wp-content/themes/twentytwentyfive/assets/images/' . $item['file'];
    $file = wp_upload_bits('weekender-' . basename($source), null, file_get_contents($source));
    if ($file['error']) {
        WP_CLI::error($file['error']);
    }
    $id = weekender_result(wp_insert_attachment([
        'post_name' => 'weekender-fixture-image-' . $index,
        'post_title' => $item['title'],
        'post_excerpt' => $item['caption'],
        'post_content' => 'CC0 source: ' . $item['source'],
        'post_mime_type' => wp_check_filetype($file['file'])['type'],
        'guid' => $file['url'],
    ], $file['file'], 0, true));
    wp_update_attachment_metadata($id, wp_generate_attachment_metadata($id, $file['file']));
    update_post_meta($id, '_wp_attachment_image_alt', $item['alt']);
    $attachmentIds[] = $id;
    $imageSources[] = [
        'attachmentId' => $id,
        'source' => str_replace(ABSPATH, '', $source),
        'sha256' => hash_file('sha256', $source),
    ];
}

$guide = wp_upload_bits('weekender-fictional-guide.txt', null,
    "Macedon Weekender — fictional guide\n\nMake room for a slow morning. Pack a warm layer, refillable water bottle, notebook and comfortable shoes. This is an invented editorial fixture, not current travel or safety advice.\n"
);
if ($guide['error']) {
    WP_CLI::error($guide['error']);
}
$guideId = weekender_result(wp_insert_attachment([
    'post_name' => 'weekender-fictional-guide',
    'post_title' => 'A fictional unhurried weekend guide',
    'post_mime_type' => 'text/plain',
    'guid' => $guide['url'],
], $guide['file'], 0, true));

$published = [];
$all = [];
$sections = $scenario === 'publisher' ? weekender_complete_sections(reset($authors)) : [];
foreach ($fixture['articles'] as $index => $story) {
    $content = '';
    foreach ($story['paragraphs'] as $paragraph) {
        $content .= '<!-- wp:paragraph --><p>' . esc_html($paragraph) . '</p><!-- /wp:paragraph -->' . "\n";
    }
    if ($story['status'] === 'publish') {
        $content .= '<!-- wp:heading --><h2 class="wp-block-heading">Make it your own</h2><!-- /wp:heading -->' . "\n";
        $content .= '<!-- wp:paragraph --><p>Read our <a href="' . esc_url(wp_get_attachment_url($guideId)) . '">fictional weekend guide</a>, and leave time for a useful detour.</p><!-- /wp:paragraph -->';
    }
    if ($scenario === 'publisher') {
        $content .= weekender_complete_blocks($story, $attachmentIds, $sections);
    }
    $date = $story['date'] ?? ($scenario === 'publisher'
        ? gmdate('Y-m-d', strtotime('2026-09-30 00:00:00 UTC') - $index * DAY_IN_SECONDS) . ' 09:00:00'
        : '2026-09-' . str_pad((string) (20 - $index), 2, '0', STR_PAD_LEFT) . ' 09:00:00');
    if (isset($story['scheduleAfterMinutes'])) {
        $date = current_datetime()->modify('+' . (int) $story['scheduleAfterMinutes'] . ' minutes')->format('Y-m-d H:i:s');
    }
    $id = weekender_result(wp_insert_post([
        'post_name' => $story['slug'],
        'post_type' => 'post',
        'post_title' => $story['title'],
        'post_excerpt' => $story['excerpt'],
        'post_content' => $content,
        'post_status' => $story['status'],
        'post_author' => $authors[$story['author']],
        'post_date' => $date,
        'comment_status' => 'closed',
    ], true));
    weekender_result(wp_set_post_categories($id, [$terms[$story['category']]]));
    weekender_result(wp_set_post_tags($id, isset($story['tag']) ? [$story['tag']] : []));
    if ($story['status'] === 'publish') {
        set_post_thumbnail($id, $attachmentIds[$index % count($attachmentIds)]);
        $published[] = $id;
    }
    $all[] = [
        'id' => $id,
        'slug' => $story['slug'],
        'status' => get_post_status($id),
        'url' => get_permalink($id),
        'author' => $story['author'],
        'title' => $story['title'],
        'dateUTC' => get_post_field('post_date_gmt', $id),
    ];
}

$pageFixtures = [
    ['about', 'About the Weekender', 'Macedon Weekender is an invented independent regional publisher. The people, stories and comments here are fictional. This WordPress source is used to prove a migration into an independently editable App Composer destination.'],
    ['weekend-guide', 'Plan a slow weekend', 'Choose one walk, one table and one thing worth noticing. This is a fictional editorial guide, not current travel advice.'],
    ['editorial-policy', 'Our editorial policy', 'We label fictional content, preserve image attribution and keep unpublished work private. No fictional reader comment is a customer endorsement.'],
];
$pages = [];
if ($scenario === 'publisher') {
    $pageFixtures = json_decode(file_get_contents('/fixture/complete/pages.json'), true, 32, JSON_THROW_ON_ERROR);
}
$pageIds = [];
foreach ($pageFixtures as $index => $page) {
    $slug = $scenario === 'publisher' ? $page['slug'] : $page[0];
    $title = $scenario === 'publisher' ? $page['title'] : $page[1];
    $paragraphs = $scenario === 'publisher' ? $page['paragraphs'] : [$page[2]];
    $body = '';
    foreach ($paragraphs as $paragraph) {
        $body .= '<!-- wp:paragraph --><p>' . esc_html($paragraph) . '</p><!-- /wp:paragraph -->' . "\n";
    }
    $parent = $scenario === 'publisher' ? (isset($page['parent']) ? $pageIds[$page['parent']] : 0) : ($index === 2 ? $pages[0]['id'] : 0);
    $id = weekender_result(wp_insert_post([
        'post_type' => 'page',
        'post_name' => $slug,
        'post_title' => $title,
        'post_content' => $body,
        'post_status' => 'publish',
        'post_author' => reset($authors),
        'post_parent' => $parent,
    ], true));
    $pageIds[$slug] = $id;
    $pages[] = ['id' => $id, 'slug' => $slug, 'url' => get_permalink($id)];
}

$first = $published[0];
$parent = wp_insert_comment([
    'comment_post_ID' => $first,
    'comment_author' => 'Fictional reader Rowan',
    'comment_author_email' => 'rowan@example.test',
    'comment_content' => 'Fictional lab comment: I like the idea of leaving an empty line on the plan.',
    'comment_approved' => 1,
]);
wp_insert_comment([
    'comment_post_ID' => $first,
    'comment_author' => 'Fictional editor Mira',
    'comment_author_email' => 'mira@example.test',
    'comment_content' => 'Fictional reply: the unplanned hour is often the best part.',
    'comment_parent' => $parent,
    'comment_approved' => 1,
]);

$themeRoot = WP_CONTENT_DIR . '/themes/macedon-weekender-lab';
wp_mkdir_p($themeRoot);
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator('/fixture/theme', FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);
foreach ($iterator as $item) {
    $relative = substr($item->getPathname(), strlen('/fixture/theme/'));
    $destination = $themeRoot . '/' . $relative;
    if ($item->isDir()) {
        wp_mkdir_p($destination);
    } else {
        copy($item->getPathname(), $destination);
    }
}
switch_theme('macedon-weekender-lab');
flush_rewrite_rules();
update_option('composer_weekender_fixture', 1);
update_option('composer_weekender_scenario', $scenario);
WP_CLI::line(json_encode([
    'fictional' => true,
    'scenario' => $scenario,
    'version' => get_bloginfo('version'),
    'timezone' => wp_timezone_string(),
    'permalink' => get_option('permalink_structure'),
    'articles' => $all,
    'pages' => $pages,
    'images' => $imageSources,
    'download' => ['id' => $guideId, 'url' => wp_get_attachment_url($guideId)],
    'comments' => get_comments(['post_id' => $first, 'count' => true]),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
