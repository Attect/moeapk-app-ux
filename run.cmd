@echo off
REM MoeApk App Web 原型本地服务器（可选；index.html 双击即 file:// 可开）
cd /d %~dp0
python -m http.server 8095
