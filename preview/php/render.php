<?php
// Renders plugin/src/{shared,full}.liquid with keepsuit/liquid 0.12.0, the Liquid engine
// and version LaraPaper 0.43.0 uses, and checks the polling URL and headers the way
// LaraPaper resolves them (Plugin::resolveLiquidVariables).
//
//   php render.php <context.json> > body.html      (context from render.mjs --dump-context)
//
// Checks fail with a non-zero exit; the rendered markup goes to stdout.

require __DIR__.'/vendor/autoload.php';

use Keepsuit\Liquid\EnvironmentFactory;
use Keepsuit\Liquid\Filters\FiltersProvider;
use Symfony\Component\Yaml\Yaml;

// LaraPaper's App\Liquid\Filters\Data::json
class DataFilters extends FiltersProvider
{
    public function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}

function fail(string $message): never
{
    fwrite(STDERR, "FAIL: $message\n");
    exit(1);
}

$src = __DIR__.'/../../plugin/src/';
$context = json_decode(file_get_contents($argv[1] ?? fail('usage: php render.php <context.json>')), true)
    ?? fail('context is not valid JSON');
$settings = Yaml::parse(preg_split('/^---[ \t]*\r?\n/m', file_get_contents($src.'settings.yml'), 2)[1]);

$config = $context['trmnl']['plugin_settings']['custom_fields_values'];
$config['ha_url'] = 'http://homeassistant:8123';
$config['ha_token'] = 'test.token';

$environment = EnvironmentFactory::new()->setRethrowErrors(true)->build();
$resolve = fn (string $template, array $data) => $environment->parseString($template)->render($environment->newRenderContext(data: $data));

// Polling URLs: one per calendar entity, dated around today (PHP DateTime relative dates)
$urls = array_values(array_filter(array_map('trim', explode("\n", $resolve($settings['polling_url'], $config)))));
$entities = array_values(array_filter(array_map('trim', explode(',', $config['calendars'] ?? ''))));
count($urls) === count($entities) || fail('expected '.count($entities).' polling URLs, got '.count($urls).': '.implode(' ', $urls));
$today = date('Y-m-d');
foreach ($urls as $i => $url) {
    preg_match('#^http://homeassistant:8123/api/calendars/'.preg_quote($entities[$i], '#').'\?start=(\d{4}-\d{2}-\d{2})&end=(\d{4}-\d{2}-\d{2})$#', $url, $m)
        || fail("unexpected polling URL: $url");
    ($m[1] < $today && $m[2] > $today) || fail("polling window $m[1]..$m[2] does not include today");
}

// Header: LaraPaper's importer turns "=" into ":" before resolving
$header = trim($resolve(str_replace('=', ':', $settings['polling_headers']), $config));
$header === 'Authorization:Bearer test.token' || fail("unexpected polling header: $header");

// Markup, with the same filters and context shape as Plugin::render
$environment->filterRegistry->register(DataFilters::class);
$markup = file_get_contents($src.'shared.liquid')."\n".file_get_contents($src.'full.liquid');
$html = $resolve($markup, $context);

str_contains($html, 'data-calendar-config=') || fail('rendered markup has no calendar element');
$dither = ($config['dither_greys'] ?? 'no') === 'yes';
str_contains($html, 'class="image-dither"') === $dither || fail('dither marker does not match the dither_greys setting');
foreach (['file:', '//localhost', '//127.'] as $blocked) { // Browsershot::setHtml rejects these
    stripos($html, $blocked) === false || fail("rendered markup contains \"$blocked\", which Browsershot rejects");
}

fwrite(STDERR, 'ok: '.count($urls)." polling URL(s), header, markup\n");
echo $html;
