@echo off 
set PYTHONPATH=%d:\NEXUS\synth-stocks-play\backend%;%d:\NEXUS\synth-stocks-play\backend%\backend 
env\Scripts\python.exe -u backend\server.py 
pause
