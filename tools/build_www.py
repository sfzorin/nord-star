#!/usr/bin/env python3
"""Copy the web app into www/ — the folder Capacitor packs into the Android APK.

The site itself (GitHub Pages) is served from the repo root; www/ is a build artefact (gitignored).
Run: python3 tools/build_www.py   (or: npm run www / npm run apk)
"""
import os
import shutil

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'www')
ITEMS = ['index.html', 'icon.svg', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'data', 'vendor']

shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
n = 0
for it in ITEMS:
    src = os.path.join(root, it)
    dst = os.path.join(out, it)
    if os.path.isdir(src):
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns('.DS_Store', '*.map'))
        n += sum(len(f) for _, _, f in os.walk(dst))
    else:
        shutil.copy2(src, dst)
        n += 1
print(f'www/: {n} files')
