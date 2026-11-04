<?php
// GET /api/telegram-setup?key=<WEBHOOK_SECRET>
// Откройте эту ссылку один раз после загрузки сайта: она подключит бота
// (вебхук, команды, кнопка «Магазин» внизу чата и описание бота).
require __DIR__ . '/lib.php';

function page($title, $rows = [], $status = 200, $hint = '')
{
    $list = '';
    foreach ($rows as $r) {
        list($label, $okay, $note) = array_pad($r, 3, '');
        $list .= '<li class="' . ($okay ? 'ok' : 'bad') . '"><span>' . ($okay ? '✓' : '✗') . '</span><div><b>' . esc($label) . '</b>'
            . ($note !== '' ? '<small>' . esc($note) . '</small>' : '') . '</div></li>';
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . esc($title) . '</title><style>'
        . 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a14;color:#f5f3ff;font:16px/1.5 system-ui,sans-serif;padding:16px}'
        . 'main{width:min(520px,100%);padding:28px;border-radius:24px;background:#16132a;border:1px solid rgba(255,255,255,.12)}'
        . 'h1{margin:0 0 16px;font-size:22px} ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}'
        . 'li{display:flex;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.05)}'
        . 'li span{font-weight:800} li.ok span{color:#4fcb7a} li.bad span{color:#ff8a7a}'
        . 'small{display:block;color:#a9a5c7;word-break:break-word} p{color:#a9a5c7;margin:16px 0 0}'
        . '.bar{height:4px;border-radius:4px;margin:-28px -28px 24px;background:linear-gradient(90deg,#ff8a7a,#ffa23a,#ffe14d,#b6e35a,#4fc3d9,#5b8cff,#8b6cff,#d46cf0)}'
        . '</style></head><body><main><div class="bar"></div><h1>' . esc($title) . '</h1><ul>' . $list . '</ul>'
        . ($hint !== '' ? '<p>' . $hint . '</p>' : '') . '</main></body></html>';
    exit;
}

$secret = webhook_secret();
if (bot_token() === '') page('Не задан BOT_TOKEN', [['Впишите BOT_TOKEN в файл api/config.php', false]], 500);
if (!preg_match('/^[A-Za-z0-9_-]{8,256}$/', $secret)) {
    page('Нужен WEBHOOK_SECRET', [['WEBHOOK_SECRET в api/config.php: от 8 символов, только латиница, цифры, _ и -', false]], 500);
}
if (($_GET['key'] ?? '') !== $secret) page('Неверный ключ', [['В ссылке должно быть ?key=ваш WEBHOOK_SECRET', false]], 403);

$site = site_url();
try {
    $shop = load_shop();
} catch (Throwable $e) {
    $shop = null;
}
$name = $shop['name'] ?? 'Pyexdg';
$rows = [];

$me = tg('getMe');
$rows[] = ['Бот найден', !empty($me['ok']), !empty($me['ok']) ? '@' . $me['result']['username'] : ($me['description'] ?? '')];
if (empty($me['ok'])) page('Бот не подключён', $rows, 502, 'Проверьте BOT_TOKEN: его выдаёт @BotFather.');

$hook = tg('setWebhook', [
    'url' => $site . '/api/telegram-webhook',
    'secret_token' => $secret,
    'allowed_updates' => ['message'],
    'drop_pending_updates' => true,
]);
$rows[] = ['Вебхук', !empty($hook['ok']), !empty($hook['ok']) ? $site . '/api/telegram-webhook' : ($hook['description'] ?? '')];

$commands = tg('setMyCommands', ['commands' => [
    ['command' => 'start', 'description' => 'Открыть магазин'],
    ['command' => 'shop', 'description' => 'Каталог и корзина'],
    ['command' => 'contacts', 'description' => 'Наши соцсети'],
]]);
$rows[] = ['Команды бота', !empty($commands['ok']), !empty($commands['ok']) ? '/start, /shop, /contacts' : ($commands['description'] ?? '')];

$menu = tg('setChatMenuButton', ['menu_button' => ['type' => 'web_app', 'text' => 'Магазин', 'web_app' => ['url' => $site]]]);
$rows[] = ['Кнопка «Магазин» в чате', !empty($menu['ok']), !empty($menu['ok']) ? $site : ($menu['description'] ?? '')];

$tagline = !empty($shop['tagline']) ? ' ' . $shop['tagline'] . '.' : '';
$desc = tg('setMyDescription', [
    'description' => mb_substr($name . ' 🌈' . $tagline . "\n\nКаталог, корзина и заказ прямо в Telegram. Ищете вещь под заказ? Оставьте заявку или просто напишите сюда.", 0, 512, 'UTF-8'),
]);
$short = tg('setMyShortDescription', ['short_description' => mb_substr($name . ': каталог, заказ и связь прямо в Telegram', 0, 120, 'UTF-8')]);
$rows[] = ['Описание бота', !empty($desc['ok']) && !empty($short['ok']), (!empty($desc['ok']) && !empty($short['ok'])) ? '' : ($desc['description'] ?? ($short['description'] ?? ''))];

$admin = admin_chat_id();
$rows[] = ['Получатель заказов (ADMIN_CHAT_ID)', $admin !== '', $admin !== '' ? $admin : 'Напишите боту /myid и впишите число в ADMIN_CHAT_ID в api/config.php'];

$allOk = true;
foreach ($rows as $r) if (!$r[1]) $allOk = false;
$username = esc($me['result']['username']);
page(
    $allOk ? 'Бот @' . $me['result']['username'] . ' подключён ✓' : 'Почти готово',
    $rows,
    200,
    'Откройте <a style="color:#ffe14d" href="https://t.me/' . $username . '">@' . $username . '</a> и нажмите «Запустить».'
);
