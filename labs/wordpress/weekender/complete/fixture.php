<?php
// Source-only input. The native WordPress engine owns all resulting records.
if (!defined('WP_CLI') || !WP_CLI) {
    throw new RuntimeException('Select the registered fictional WordPress CLI.');
}
$extra = json_decode(file_get_contents('/fixture/complete/articles.json'), true, 32, JSON_THROW_ON_ERROR);
$fixture['articles'] = array_merge($fixture['articles'], $extra);
if (count($fixture['articles']) !== 30 || count($fixture['authors']) !== 3) {
    WP_CLI::error('The complete publisher fixture requires exactly 30 articles and three bylines.');
}
$bodies = [
    'draft-the-next-weekender' => [
        'This complete fictional draft opens the next Weekender edition with a morning in an invented garden. Jo has written the body and chosen a working title, but the editor has not approved publication. The record must remain a draft after import.',
        'The proposed story follows a short walk, a shared lunch and a return to the kitchen table. Before the edition is ready, the editor needs to check the image description and confirm the byline. These are ordinary editorial tasks, not authority granted by the import file.',
        'Saving an edit should preserve the live archive. A native owner can preview this work privately and publish it explicitly when ready. An unauthenticated visitor must receive 404 at its old or new address until that separate publication step happens.',
    ],
    'private-editorial-notes' => [
        'These are complete fictional private editorial notes for the Weekender lab. They contain no personal or customer material, but their visibility still matters. Import must not turn a private source record into a public story or search result.',
        'The imagined editorial meeting discusses the order of the next three articles and a missing image caption. Mira will revise the field note, Jo will check the meal story and Eli will confirm the notebook illustration. All three identities are fictional.',
        'The destination owner may inspect and revise these notes in the native interface. Public routes, taxonomy archives and redirects must continue to refuse them. A known source ID is a reconciliation key, not permission to reveal the record.',
    ],
    'pending-reader-contribution' => [
        'This complete fictional contribution is waiting for editorial review. It describes an invented afternoon spent writing beside a window while the weather changes outside. No real reader or invitation to send material is represented.',
        'The contributor has supplied a beginning, middle and ending. The editor still needs to decide whether the piece belongs in the edition and whether its illustrative image has a complete caption. Pending is an actual workflow state, not a synonym for public.',
        'After migration, an owner must be able to revise and preview the record without exposing it. Publication requires an explicit native decision. The public search, original source address and destination slug remain unavailable until that decision is made.',
    ],
    'scheduled-autumn-notes' => [
        'This complete fictional article is scheduled for 22 April 2032 at 08:30 in Australia/Melbourne. It is a long-term visibility fixture, separate from the near-term article used to exercise actual scheduled execution during the lab.',
        'Eli imagines returning to the same garden in autumn, with a notebook open beside a small pile of fallen leaves. The route, garden and people are invented. The observation is about noticing a familiar place again after time has passed.',
        'The migration must preserve the source UTC instant and private future state, or document a deliberate supported conversion. It must never publish the article merely because an import or build succeeds. The far-future time is not advanced in order to make a scheduler test appear complete.',
    ],
];
foreach ($fixture['articles'] as &$story) {
    if (isset($bodies[$story['slug']])) {
        $story['paragraphs'] = $bodies[$story['slug']];
    }
}
unset($story);

function weekender_complete_sections($author) {
    $sections = [
        'notebook' => ['A useful field note', 'Write the date, weather and one small thing you noticed. This shared fictional notebook note is a genuine WordPress synced block, referenced by two complete articles.'],
        'welcome' => ['Make room at the table', 'Ask what people need, keep the way to a seat clear and make water easy to reach. This shared fictional welcome note is a genuine WordPress synced block used by two articles.'],
    ];
    $ids = [];
    foreach ($sections as $key => [$title, $text]) {
        $ids[$key] = weekender_result(wp_insert_post([
            'post_type' => 'wp_block', 'post_status' => 'publish',
            'post_title' => $title, 'post_name' => 'weekender-' . $key,
            'post_author' => $author,
            'post_content' => '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">' . esc_html($title) . '</h3><!-- /wp:heading -->' . "\n" .
                '<!-- wp:paragraph --><p>' . esc_html($text) . '</p><!-- /wp:paragraph -->',
        ], true));
    }
    return $ids;
}

function weekender_complete_blocks($story, $attachments, $sections) {
    $content = '';
    if (!empty($story['gallery'])) {
        $content .= '<!-- wp:gallery {"linkTo":"none"} --><figure class="wp-block-gallery has-nested-images columns-default is-cropped">';
        foreach ($attachments as $id) {
            $caption = get_post_field('post_excerpt', $id);
            $content .= '<!-- wp:image ' . wp_json_encode(['id' => $id, 'sizeSlug' => 'full', 'linkDestination' => 'none']) . ' -->' .
                '<figure class="wp-block-image size-full"><img src="' . esc_url(wp_get_attachment_url($id)) . '" alt="' . esc_attr(get_post_meta($id, '_wp_attachment_image_alt', true)) . '" class="wp-image-' . $id . '"/>' .
                '<figcaption class="wp-element-caption">' . esc_html($caption) . '</figcaption></figure><!-- /wp:image -->';
        }
        $content .= '</figure><!-- /wp:gallery -->' . "\n";
    }
    if (isset($story['synced'])) {
        if (!isset($sections[$story['synced']])) {
            WP_CLI::error('Select a declared source synced block.');
        }
        $content .= '<!-- wp:block ' . wp_json_encode(['ref' => $sections[$story['synced']]]) . ' /-->' . "\n";
    }
    if (!empty($story['dynamicLatest'])) {
        $content .= '<!-- wp:heading --><h2 class="wp-block-heading">The latest from the Weekender</h2><!-- /wp:heading -->' . "\n" .
            '<!-- wp:latest-posts {"postsToShow":5,"displayPostDate":true} /-->' . "\n";
    }
    return $content;
}
