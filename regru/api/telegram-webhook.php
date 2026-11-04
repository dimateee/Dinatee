<?php
// POST /api/telegram-webhook — Telegram присылает сюда сообщения боту.
// Адрес прописывается один раз ссылкой /api/telegram-setup?key=… (см. README).
//
// Что умеет бот:
// • /start, /shop — приветствие, кнопка «Открыть магазин» и кнопки соцсетей;
// • /contacts — все ссылки; /myid — показать chat id (для ADMIN_CHAT_ID);
// • сообщение покупателя → приходит владельцу с меткой #u<id>;
// • владелец отвечает (Reply) на сообщение с меткой → бот пересылает ответ покупателю.
require __DIR__ . '/lib.php';

const MEDIA_WITH_CAPTION = ['photo', 'video', 'document', 'audio', 'voice', 'animation'];

function shop_button($site)
{
    return preg_match('#^https://#i', $site)
        ? ['text' => '🛍 Открыть магазин', 'web_app' => ['url' => $site]]
        : ['text' => '🛍 Открыть магазин', 'url' => $site !== '' ? $site : 'https://t.me'];
}

function try_load_shop()
{
    try {
        return load_shop();
    } catch (Throwable $e) {
        error_log($e->getMessage());
        return null;
    }
}

function send_welcome($chatId, $from, $shop, $site)
{
    $name = $shop['name'] ?? 'Pyexdg';
    $email = trim((string) ($shop['contacts']['email'] ?? ''));
    $hello = !empty($from['first_name']) ? 'Привет, ' . esc($from['first_name']) . '!' : 'Привет!';
    $lines = [$hello . ' Это <b>' . esc($name) . '</b> 🌈'];
    if (!empty($shop['tagline'])) $lines[] = '<i>' . esc($shop['tagline']) . '</i>';
    array_push(
        $lines,
        '',
        '🛍 Откройте магазин кнопкой ниже: каталог, корзина и заказ в пару нажатий.',
        '🔎 Не нашли нужное? В магазине есть заявка «Под заказ».',
        '💬 Есть вопрос? Пишите прямо сюда, ответим.'
    );
    if ($email !== '') $lines[] = '✉️ Почта: ' . esc($email);

    return tg('sendMessage', [
        'chat_id' => $chatId,
        'text' => implode("\n", $lines),
        'parse_mode' => 'HTML',
        'reply_markup' => ['inline_keyboard' => array_merge([[shop_button($site)]], social_buttons($shop))],
    ]);
}

function send_contacts($chatId, $shop, $site)
{
    $email = trim((string) ($shop['contacts']['email'] ?? ''));
    $text = ['<b>Мы на связи</b> 💫', '', 'Подписывайтесь, чтобы не пропустить новинки.'];
    if ($email !== '') $text[] = '✉️ Почта: ' . esc($email);
    return tg('sendMessage', [
        'chat_id' => $chatId,
        'text' => implode("\n", $text),
        'parse_mode' => 'HTML',
        'reply_markup' => ['inline_keyboard' => array_merge(social_buttons($shop), [[shop_button($site)]])],
    ]);
}

function who_html($from)
{
    $name = trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? ''));
    if ($name === '') $name = 'Покупатель';
    $line = '👤 <a href="tg://user?id=' . (int) $from['id'] . '">' . esc($name) . '</a>';
    if (!empty($from['username'])) $line .= ' @' . esc($from['username']);
    return $line . "\n" . user_tag((int) $from['id']);
}

function cut($s, $max)
{
    return function_exists('mb_substr') ? mb_substr((string) $s, 0, $max, 'UTF-8') : substr((string) $s, 0, $max);
}

// Сообщение покупателя → владельцу
function relay_to_admin($msg, $admin)
{
    $who = who_html($msg['from']);
    if (isset($msg['text'])) {
        return tg('sendMessage', [
            'chat_id' => $admin,
            'text' => "💬 <b>Сообщение от покупателя</b>\n\n" . esc(cut($msg['text'], 3500)) . "\n\n" . $who,
            'parse_mode' => 'HTML',
            'link_preview_options' => ['is_disabled' => true],
        ]);
    }
    foreach (MEDIA_WITH_CAPTION as $kind) {
        if (isset($msg[$kind])) {
            $parts = array_filter([isset($msg['caption']) ? esc(cut($msg['caption'], 800)) : '', '💬 Сообщение от покупателя', $who], 'strlen');
            return tg('copyMessage', [
                'chat_id' => $admin,
                'from_chat_id' => $msg['chat']['id'],
                'message_id' => $msg['message_id'],
                'caption' => implode("\n\n", $parts),
                'parse_mode' => 'HTML',
            ]);
        }
    }
    // стикеры, кружки и прочее без подписи: сначала заголовок с меткой, потом само сообщение
    tg('sendMessage', ['chat_id' => $admin, 'text' => "💬 <b>Сообщение от покупателя</b> (ниже)\n\n" . $who, 'parse_mode' => 'HTML']);
    return tg('copyMessage', ['chat_id' => $admin, 'from_chat_id' => $msg['chat']['id'], 'message_id' => $msg['message_id']]);
}

function handle_message($msg)
{
    $chatId = $msg['chat']['id'];
    $admin = admin_chat_id();
    $isAdmin = $admin !== '' && (string) $chatId === $admin;
    $text = trim((string) ($msg['text'] ?? ''));
    $cmd = '';
    if ($text !== '' && $text[0] === '/') {
        $first = preg_split('/\s+/', $text)[0];
        $cmd = mb_strtolower(explode('@', $first)[0], 'UTF-8');
    }

    if ($cmd === '/myid') {
        return tg('sendMessage', [
            'chat_id' => $chatId,
            'text' => 'Ваш chat id: <code>' . $chatId . "</code>\n\nЧтобы получать заказы, впишите это число в <b>ADMIN_CHAT_ID</b> в файле api/config.php на хостинге.",
            'parse_mode' => 'HTML',
        ]);
    }

    if (in_array($cmd, ['/start', '/shop', '/contacts', '/help'], true)) {
        $site = site_url();
        $shop = try_load_shop();
        if ($cmd === '/contacts') return send_contacts($chatId, $shop, $site);
        send_welcome($chatId, $msg['from'], $shop, $site);
        if ($isAdmin && ($cmd === '/start' || $cmd === '/help')) {
            tg('sendMessage', [
                'chat_id' => $chatId,
                'text' => "👑 Вы владелец магазина. Сюда будут приходить заказы, заявки и сообщения покупателей.\n\nЧтобы ответить покупателю, нажмите «Ответить» на его заказе или сообщении и напишите текст: бот перешлёт его покупателю.",
            ]);
        }
        return null;
    }

    if ($isAdmin) {
        $reply = $msg['reply_to_message'] ?? null;
        $target = $reply ? read_user_tag(($reply['text'] ?? '') . ' ' . ($reply['caption'] ?? '')) : '';
        if ($target !== '') {
            $r = tg('copyMessage', ['chat_id' => $target, 'from_chat_id' => $chatId, 'message_id' => $msg['message_id']]);
            return tg('sendMessage', [
                'chat_id' => $chatId,
                'text' => !empty($r['ok']) ? '✓ Отправлено покупателю' : 'Не получилось отправить: ' . ($r['description'] ?? 'ошибка') . '. Возможно, покупатель остановил бота.',
                'reply_parameters' => ['message_id' => $msg['message_id'], 'allow_sending_without_reply' => true],
            ]);
        }
        if ($cmd === '') {
            return tg('sendMessage', [
                'chat_id' => $chatId,
                'text' => 'Чтобы ответить покупателю, нажмите «Ответить» на его заказе или сообщении (там есть метка #u…) и напишите текст.',
            ]);
        }
        return null;
    }

    if ($cmd !== '' || $admin === '') return null; // неизвестные команды покупателей не пересылаем
    return relay_to_admin($msg, $admin);
}

$secret = webhook_secret();
if ($secret === '' || ($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '') !== $secret) {
    http_response_code(403);
    echo 'forbidden';
    exit;
}

$update = json_decode((string) file_get_contents('php://input'), true);
$msg = is_array($update) ? ($update['message'] ?? null) : null;
if (is_array($msg) && ($msg['chat']['type'] ?? '') === 'private' && !empty($msg['from']) && empty($msg['from']['is_bot'])) {
    try {
        handle_message($msg);
    } catch (Throwable $e) {
        error_log($e->getMessage());
    }
}

// Telegram должен получить 200, иначе будет повторять запрос
http_response_code(200);
echo 'ok';
