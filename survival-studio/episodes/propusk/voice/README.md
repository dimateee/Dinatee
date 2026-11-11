# Голос — «Пропуск»

- Голос: ElevenLabs, премиальный голос George (`JBFqnCBsd6RMkjVDRZzb`), модель `eleven_multilingual_v2`,
  stability 0.55, similarity 0.75, style 0, speed 1.08. Текст — `vo_text.txt`.
- `raw_george_v3.mp3` — исходник от ElevenLabs (82,9 с).
- Монтаж: `tools/voice_edit.py --keep 0.26` — 12 пауз > 0,5 с сокращены до 0,26 с, кроссфейд 20 мс → 79,0 с.
- Обработка: `tools/voice_process.sh` → `voice_final.flac` (в git; `.wav` восстанавливается
  `ffmpeg -i voice_final.flac voice_final.wav`).
- Итог: −14,4 LUFS, true peak −1,0 dBTP, LRA 2,0 LU (у исходника TTS 1,7 LU — синтез ровный по природе;
  поднимать до 4–6 LU пришлось бы искусственным расширением, не стал).
- Темп: 189 слов / 79 с ≈ 2,4 сл/с.
- `samples/` — пробы трёх голосов (Brian, Daniel, George) на первой фразе.
- Слова с таймкодами: `../words.json` (faster-whisper medium, выравнивание по сценарию, 187/189 точных совпадений).
