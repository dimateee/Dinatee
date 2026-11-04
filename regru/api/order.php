<?php
// POST /api/order — мини-апп присылает сюда заказ из корзины или заявку «Под заказ».
// Проверяем, что запрос пришёл из Telegram, пересчитываем цены по js/config.js,
// присылаем уведомление владельцу (ADMIN_CHAT_ID) и подтверждение покупателю.
require __DIR__ . '/lib.php';

function build_order($body, $shop)
{
    $currency = $shop['currency'] ?? '₽';
    $byId = [];
    foreach ($shop['products'] as $p) if (is_array($p) && isset($p['id'])) $byId[(string) $p['id']] = $p;

    $seen = [];
    $lines = [];
    $total = 0;
    $items = is_array($body['items'] ?? null) ? array_slice($body['items'], 0, 50) : [];
    foreach ($items as $item) {
        $id = is_array($item) && isset($item['id']) && is_scalar($item['id']) ? (string) $item['id'] : '';
        $p = $byId[$id] ?? null;
        if (!$p || !empty($p['soldOut']) || isset($seen[$id]) || !is_numeric($p['price'] ?? null) || $p['price'] < 0) continue;
        $qty = (int) (is_scalar($item['qty'] ?? null) ? $item['qty'] : 0);
        if ($qty === 0) $qty = 1;
        $qty = min(99, max(1, $qty));
        $seen[$id] = true;
        $total += $qty * $p['price'];
        $lines[] = [$p, $qty];
    }
    if (!$lines) return ['error' => 'Корзина пуста'];

    $list = [];
    $short = [];
    foreach ($lines as $i => $l) {
        list($p, $qty) = $l;
        $list[] = ($i + 1) . '. ' . esc($p['name'] ?? '') . ' — ' . $qty . ' шт. × ' . esc(money($p['price'], $currency))
            . ' = <b>' . esc(money($qty * $p['price'], $currency)) . '</b>';
        $short[] = ($i + 1) . '. ' . esc($p['name'] ?? '') . ' — ' . $qty . ' шт.';
    }
    $totalLine = 'Итого: <b>' . esc(money($total, $currency)) . '</b>';

    return [
        'admin' => array_merge(['🛍 <b>Новый заказ</b>', ''], $list, ['', $totalLine]),
        'buyer' => array_merge(['✅ <b>Заказ принят!</b>', ''], $short, ['', $totalLine, '', 'Скоро напишем вам здесь, чтобы уточнить детали и доставку.']),
    ];
}

function build_request($body, $shop)
{
    $currency = $shop['currency'] ?? '₽';
    $f = is_array($body['fields'] ?? null) ? $body['fields'] : [];
    $budgetRaw = is_scalar($f['budget'] ?? null) ? (string) $f['budget'] : '';
    $d = [
        'item' => clip($f['item'] ?? '', 80),
        'brand' => clip($f['brand'] ?? '', 80),
        'size' => clip($f['size'] ?? '', 40),
        'color' => clip($f['color'] ?? '', 40),
        'budget' => substr(preg_replace('/\D/', '', $budgetRaw), 0, 9),
        'link' => clip($f['link'] ?? '', 300),
        'details' => clip($f['details'] ?? '', 1000),
        'name' => clip($f['name'] ?? '', 40),
    ];
    if (mb_strlen($d['item'], 'UTF-8') < 2) return ['error' => 'Напишите, какая вещь нужна'];

    $rows = [
        ['Что нужно', $d['item']],
        ['Бренд / модель', $d['brand']],
        ['Размер', $d['size']],
        ['Цвет', $d['color']],
        ['Бюджет', $d['budget'] !== '' ? 'до ' . money($d['budget'], $currency) : ''],
        ['Пример', $d['link']],
        ['Подробности', $d['details']],
        ['Имя', $d['name']],
    ];
    $admin = ['🔎 <b>Заявка под заказ</b>', ''];
    foreach ($rows as $r) if ($r[1] !== '') $admin[] = $r[0] . ': ' . esc($r[1]);

    return [
        'admin' => $admin,
        'buyer' => ['✅ <b>Заявка принята!</b>', '', 'Ищем: ' . esc($d['item']), '', 'Подберём вариант, посчитаем цену и напишем вам здесь.'],
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(['error' => 'Method not allowed'], 405);

$initData = $_SERVER['HTTP_X_TELEGRAM_INIT_DATA'] ?? '';
if (!valid_init_data($initData, bot_token())) json_out(['error' => 'Откройте магазин из Telegram'], 401);

$admin = admin_chat_id();
if ($admin === '') json_out(['error' => 'Не настроен ADMIN_CHAT_ID'], 503);

$user = init_user($initData);
if (!$user) json_out(['error' => 'Нет данных покупателя'], 400);

$body = json_decode((string) file_get_contents('php://input'), true);
$type = is_array($body) ? ($body['type'] ?? '') : '';
if ($type !== 'order' && $type !== 'request') json_out(['error' => 'Bad request'], 400);

try {
    $shop = load_shop();
} catch (Throwable $e) {
    error_log($e->getMessage());
    json_out(['error' => 'Не удалось загрузить каталог'], 502);
}

$built = $type === 'order' ? build_order($body, $shop) : build_request($body, $shop);
if (isset($built['error'])) json_out(['error' => $built['error']], 400);

$adminText = implode("\n", array_merge($built['admin'], ['', buyer_html($user), '', '<i>Ответьте на это сообщение, и бот перешлёт ответ покупателю.</i>']));
$sent = tg('sendMessage', [
    'chat_id' => $admin,
    'text' => $adminText,
    'parse_mode' => 'HTML',
    'link_preview_options' => ['is_disabled' => true],
]);
if (empty($sent['ok'])) json_out(['error' => 'Не удалось отправить уведомление'], 502);

$toBuyer = tg('sendMessage', ['chat_id' => (int) $user['id'], 'text' => implode("\n", $built['buyer']), 'parse_mode' => 'HTML']);
json_out(['ok' => true, 'buyerNotified' => !empty($toBuyer['ok'])]);
