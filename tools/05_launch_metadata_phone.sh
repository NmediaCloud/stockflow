#!/data/data/com.termux/files/usr/bin/bash
#
# Phone launcher for the Stockflow metadata tool (Termux + VNC/XFCE)
# ------------------------------------------------------------------
# A Linux/Android-friendly version of 05_launch_metadata.sh / .bat.
#
# It is self-contained: it runs from whatever folder it lives in, so
# there are NO Windows "X:\..." paths to break. Any GUI window is sent
# to the VNC desktop (display :1) so it shows up in your VNC viewer.
#
# Usage (inside Termux):
#   cd ~/00_Stockflow_Export        # the folder you copied from IBM's share
#   bash 05_launch_metadata_phone.sh
#
# If your Python entry file is named differently, override it:
#   APP_FILE=my_script.py bash 05_launch_metadata_phone.sh

set -u

# --- 1. Always work from the folder this script sits in (no X:\ paths) ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
echo "==> Working directory: $SCRIPT_DIR"

# --- 2. Send any GUI window to the VNC desktop on display :1 ---
# (This is what makes Tkinter/PyQt windows appear in your VNC viewer.)
export DISPLAY=:1

# --- 3. The Python entry point. Change the name here or via APP_FILE=... ---
APP="${APP_FILE:-05_launch_metadata.py}"

# --- 4. Make sure the VNC desktop is running (so GUI apps have a screen) ---
if ! vncserver -list 2>/dev/null | grep -q ":1"; then
  echo "==> No VNC desktop on :1 yet — starting one..."
  vncserver -geometry 1920x1080 :1 || true
fi

# --- 5. Install Python dependencies if a requirements file is present ---
if [ -f requirements.txt ]; then
  echo "==> Installing Python dependencies from requirements.txt ..."
  pip install -r requirements.txt
fi

# --- 6. Sanity check: does the app file exist? ---
if [ ! -f "$APP" ]; then
  echo ""
  echo "ERROR: '$APP' was not found in $SCRIPT_DIR"
  echo "Files present here:"
  ls -1
  echo ""
  echo "If your Python file has a different name, re-run like:"
  echo "    APP_FILE=your_real_file.py bash 05_launch_metadata_phone.sh"
  exit 1
fi

# --- 7. Launch it (passes through any extra arguments) ---
echo "==> Launching $APP ..."
python "$APP" "$@"
