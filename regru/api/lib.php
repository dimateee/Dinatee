<?php
// Общие функции бота Pyexdg для обычного PHP-хостинга (REG.RU и похожие).
// Работает на PHP 7.4+ без сторонних библиотек.
// Секреты лежат в api/config.php (шаблон — config.example.php). Этот файл открывать снаружи нельзя.

ini_set('display_errors', '0');
error_reporting(E_ALL);

/* ---------- Настройки ---------- */

function cfg($key, $default = '')
{
    static $conf = null;
    if ($conf === null) {
        $file = __DIR__ . '/config.php';
        $loaded = is_file($file) ? include $file : [];
        $conf = is_array($loaded) ? $loaded : [];
    }
    $value = array_key_exists($key, $conf) ? $conf[$key] : getenv($key);
    if ($value === false || $value === null) return $default;
    // убираем пробелы и кавычки по краям — частые ошибки при копировании
    return is_string($value) ? trim(trim($value), "\"'") : $value;
}

function bot_token()
{
    return preg_replace('/^bot(?=\d)/i', '', (string) cfg('BOT_TOKEN'));
}

function admin_chat_id()
{
    return (string) cfg('ADMIN_CHAT_ID');
}

function webhook_secret()
{
    return (string) cfg('WEBHOOK_SECRET');
}

// Адрес сайта: SITE_URL из config.php, иначе адрес текущего запроса
function site_url()
{
    $site = rtrim((string) cfg('SITE_URL'), '/');
    if ($site !== '') return $site;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return ($https ? 'https://' : 'http://') . $host;
}

/* ---------- Ответы ---------- */

function json_out($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function esc($value)
{
    return htmlspecialchars((string) $value, ENT_COMPAT | ENT_SUBSTITUTE, 'UTF-8');
}

function money($n, $currency = '₽')
{
    return number_format((float) $n, 0, ',', "\u{00A0}") . ' ' . $currency;
}

/* ---------- Подпись Telegram Mini App ---------- */

function parse_query($query)
{
    $pairs = [];
    foreach (explode('&', (string) $query) as $part) {
        if ($part === '') continue;
        $kv = explode('=', $part, 2);
        $pairs[urldecode($kv[0])] = urldecode($kv[1] ?? '');
    }
    return $pairs;
}

// Проверка подписи initData по документации Telegram Mini Apps
function valid_init_data($initData, $token, $maxAgeSec = 86400)
{
    if ($initData === '' || $token === '') return false;
    $pairs = parse_query($initData);
    $hash = $pairs['hash'] ?? '';
    if ($hash === '') return false;
    unset($pairs['hash']);
    ksort($pairs, SORT_STRING);
    $lines = [];
    foreach ($pairs as $k => $v) $lines[] = $k . '=' . $v;

    $secret = hash_hmac('sha256', $token, 'WebAppData', true);
    $calculated = hash_hmac('sha256', implode("\n", $lines), $secret);
    if (strlen($calculated) !== strlen($hash)) return false;

    $authDate = (int) ($pairs['auth_date'] ?? 0);
    return (time() - $authDate) < $maxAgeSec && hash_equals($calculated, $hash);
}

function init_user($initData)
{
    $pairs = parse_query($initData);
    $user = json_decode($pairs['user'] ?? 'null', true);
    return (is_array($user) && isset($user['id']) && is_numeric($user['id'])) ? $user : null;
}

/* ---------- Bot API ---------- */

// Вызов Bot API. Ошибки не бросаем, а возвращаем ответ Telegram (ok, description)
function tg($method, $payload = [])
{
    $base = rtrim((string) cfg('TELEGRAM_API', 'https://api.telegram.org'), '/');
    $url = $base . '/bot' . bot_token() . '/' . $method;
    $body = json_encode($payload ? $payload : new stdClass(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
        ]);
        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);
    } else {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $body,
            'timeout' => 20,
            'ignore_errors' => true,
        ]]);
        $response = @file_get_contents($url, false, $context);
        $error = $response === false ? 'request failed' : '';
    }

    $data = is_string($response) ? json_decode($response, true) : null;
    if (!is_array($data)) $data = ['ok' => false, 'description' => $error !== '' ? $error : 'bad response'];
    if (empty($data['ok'])) error_log('Telegram ' . $method . ' ' . ($data['error_code'] ?? '') . ' ' . ($data['description'] ?? ''));
    return $data;
}

/* ---------- Товары и ссылки из js/config.js ---------- */

// Перевод JS-объекта (как в config.js) в JSON: комментарии, ключи без кавычек,
// одинарные кавычки и висячие запятые. Строки внутри не трогаются.
function js_literal_to_json($src)
{
    $out = '';
    $n = strlen($src);
    $i = 0;
    while ($i < $n) {
        $c = $src[$i];
        $next = $i + 1 < $n ? $src[$i + 1] : '';

        if ($c === '/' && $next === '/') {            // комментарий до конца строки
            $end = strpos($src, "\n", $i);
            $i = $end === false ? $n : $end;
            continue;
        }
        if ($c === '/' && $next === '*') {            // блочный комментарий
            $end = strpos($src, '*/', $i + 2);
            $i = $end === false ? $n : $end + 2;
            continue;
        }
        if ($c === '"' || $c === "'") {               // строка
            $quote = $c;
            $str = '';
            $i++;
            while ($i < $n && $src[$i] !== $quote) {
                if ($src[$i] === '\\' && $i + 1 < $n) {
                    $e = $src[$i + 1];
                    if ($e === "'") $str .= "'";
                    elseif ($e === 'x' && preg_match('/^[0-9a-fA-F]{2}$/', substr($src, $i + 2, 2))) {
                        $str .= '\\u00' . substr($src, $i + 2, 2);
                        $i += 2;
                    } else $str .= '\\' . $e;
                    $i += 2;
                    continue;
                }
                $str .= $src[$i] === '"' ? '\\"' : $src[$i];
                $i++;
            }
            $out .= '"' . $str . '"';
            $i++;
            continue;
        }
        if (ctype_digit($c) || ($c === '.' && ctype_digit($next))) {   // число (в том числе 1e3, .5, 0x1F)
            if (preg_match('/\G(0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/', $src, $m, 0, $i)) {
                $num = $m[1];
                if (stripos($num, '0x') === 0) $num = (string) hexdec($num);
                elseif ($num[0] === '.') $num = '0' . $num;
                elseif (substr($num, -1) === '.') $num .= '0';
                $out .= $num;
                $i += strlen($m[1]);
                continue;
            }
        }
        if (ctype_alpha($c) || $c === '_' || $c === '$') {   // ключ или true/false/null
            $j = $i;
            while ($j < $n && (ctype_alnum($src[$j]) || $src[$j] === '_' || $src[$j] === '$')) $j++;
            $word = substr($src, $i, $j - $i);
            $k = $j;
            while ($k < $n && ctype_space($src[$k])) $k++;
            if ($k < $n && $src[$k] === ':') $out .= '"' . $word . '"';
            elseif (in_array($word, ['true', 'false', 'null'], true)) $out .= $word;
            else $out .= 'null';
            $i = $j;
            continue;
        }
        if ($c === '}' || $c === ']') {               // висячая запятая
            $trimmed = rtrim($out);
            if (substr($trimmed, -1) === ',') $out = substr($trimmed, 0, -1);
        }
        $out .= $c;
        $i++;
    }
    return $out;
}

// Достаёт объект window.SHOP = { ... } из текста config.js
function extract_shop_literal($code)
{
    $n = strlen($code);
    $start = false;
    // ищем «window.SHOP =» только в коде, а не в комментариях и строках
    for ($i = 0; $i < $n && $start === false; $i++) {
        $c = $code[$i];
        $next = $i + 1 < $n ? $code[$i + 1] : '';
        if ($c === '/' && $next === '/') { $e = strpos($code, "\n", $i); $i = $e === false ? $n : $e; continue; }
        if ($c === '/' && $next === '*') { $e = strpos($code, '*/', $i + 2); $i = $e === false ? $n : $e + 1; continue; }
        if ($c === '"' || $c === "'") {
            for ($i++; $i < $n && $code[$i] !== $c; $i++) if ($code[$i] === '\\') $i++;
            continue;
        }
        if ($c === 'w' && preg_match('/\Gwindow\s*\.\s*SHOP\s*=\s*\{/', $code, $m, 0, $i)) $start = $i + strlen($m[0]) - 1;
    }
    if ($start === false) return null;
    $depth = 0;
    for ($i = $start; $i < $n; $i++) {
        $c = $code[$i];
        $next = $i + 1 < $n ? $code[$i + 1] : '';
        if ($c === '/' && $next === '/') { $e = strpos($code, "\n", $i); $i = $e === false ? $n : $e; continue; }
        if ($c === '/' && $next === '*') { $e = strpos($code, '*/', $i + 2); $i = $e === false ? $n : $e + 1; continue; }
        if ($c === '"' || $c === "'") {
            for ($i++; $i < $n && $code[$i] !== $c; $i++) if ($code[$i] === '\\') $i++;
            continue;
        }
        if ($c === '{') $depth++;
        if ($c === '}' && --$depth === 0) return substr($code, $start, $i - $start + 1);
    }
    return null;
}

function load_shop($file = null)
{
    $file = $file ?: __DIR__ . '/../js/config.js';
    $code = @file_get_contents($file);
    if ($code === false) throw new RuntimeException('config.js не найден: ' . $file);
    $literal = extract_shop_literal($code);
    if ($literal === null) throw new RuntimeException('config.js: нет window.SHOP');
    $shop = json_decode(js_literal_to_json($literal), true);
    if (!is_array($shop) || !isset($shop['products']) || !is_array($shop['products'])) {
        throw new RuntimeException('config.js: не удалось прочитать товары (' . json_last_error_msg() . ')');
    }
    return $shop;
}

/* ---------- Ссылки и покупатель ---------- */

function telegram_username($value)
{
    $v = trim((string) $value);
    if ($v === '') return '';
    $v = preg_replace('#^https?://#i', '', $v);
    $v = preg_replace('#^(www\.)?(t\.me|telegram\.me)/#i', '', $v);
    $v = preg_replace('/^@/', '', $v);
    return preg_split('#[/?\#]#', $v)[0];
}

function as_url($value)
{
    $v = trim((string) $value);
    if ($v === '') return '';
    return preg_match('#^https?://#i', $v) ? $v : 'https://' . ltrim($v, '/');
}

// Кнопки соцсетей из SHOP.contacts (только заполненные), по две в ряд
function social_buttons($shop)
{
    $c = is_array($shop['contacts'] ?? null) ? $shop['contacts'] : [];
    $items = [];
    foreach ([['📢 Telegram-канал', 'channel'], ['🏷 Авито', 'avito'], ['🎵 TikTok', 'tiktok'], ['▶️ YouTube', 'youtube']] as $b) {
        $url = as_url($c[$b[1]] ?? '');
        if ($url !== '') $items[] = ['text' => $b[0], 'url' => $url];
    }
    return array_chunk($items, 2);
}

// Метка, по которой бот понимает, кому переслать ответ владельца
function user_tag($id)
{
    return '#u' . $id;
}

function read_user_tag($text)
{
    return preg_match('/#u(\d{3,})/', (string) $text, $m) ? $m[1] : '';
}

function buyer_html($user)
{
    $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
    if ($name === '') $name = 'Покупатель';
    $line = '👤 <a href="tg://user?id=' . (int) $user['id'] . '">' . esc($name) . '</a>';
    if (!empty($user['username'])) $line .= ' @' . esc($user['username']);
    return $line . "\n" . user_tag((int) $user['id']);
}

function clip($value, $max)
{
    $s = is_scalar($value) ? trim((string) $value) : '';
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
}
