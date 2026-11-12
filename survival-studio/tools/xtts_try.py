"""Пробы встроенных голосов XTTS-v2 на русской фразе: xtts_try.py out_dir голос1 голос2 ..."""
import os, sys, torch
os.environ["COQUI_TOS_AGREED"] = "1"
from TTS.api import TTS
torch.set_num_threads(4)
out = sys.argv[1]
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
if sys.argv[2] == "--list":
    print([s for s in tts.speakers]); sys.exit()
T = "В октябре я решил бегать. До моста и обратно — два километра. Луна ждала меня у калитки."
for sp in sys.argv[2:]:
    tts.tts_to_file(text=T, speaker=sp, language="ru", file_path=os.path.join(out, sp.replace(" ", "_") + ".wav"))
    print("ok", sp, flush=True)
