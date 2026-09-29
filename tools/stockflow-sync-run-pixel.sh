#!/bin/bash
#
# Stockflow: network sync + run for Pixel / Android 16 native Linux Terminal
# -------------------------------------------------------------------------
# For the built-in Debian VM (Developer options -> Linux development
# environment). Unlike the Termux version, NO VNC is needed -- the terminal
# renders GUI app windows natively. Files are pulled from a network share
# (e.g. the IBM PC) via rclone.
#
# ONE-TIME SETUP:
#     sudo apt update
#     sudo apt install -y python3 python3-pip python3-tk rclone
#     rclone config          # create an SMB remote named "ibm" pointing at IBM
#
# THEN, each run:
#     bash stockflow-sync-run-pixel.sh
#
# Credentials live only in rclone's config on the phone -- never in this repo.

set -u

# --- Config (override via environment or ~/.stockflow.conf) ---------------
REMOTE="${STOCKFLOW_REMOTE:-ibm}"                            # rclone remote name
REMOTE_PATH="${STOCKFLOW_REMOTE_PATH:-00_Stockflow_Export}"  # share/subfolder to pull
LOCAL_DIR="${STOCKFLOW_LOCAL:-$HOME/00_Stockflow_Export}"    # where it lands
APP="${APP_FILE:-05_launch_metadata.py}"                     # Python entry point

[ -f "$HOME/.stockflow.conf" ] && . "$HOME/.stockflow.conf"

# --- 1. Make sure the tools are installed ----------------------------------
if ! command -v rclone >/dev/null 2>&1; then
  echo "==> Installing rclone ..."
  sudo apt update && sudo apt install -y rclone
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "==> Installing Python ..."
  sudo apt install -y python3 python3-pip python3-tk
fi

# --- 2. Make sure the network remote is configured -------------------------
if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE}:"; then
  echo ""
  echo "ERROR: rclone remote '${REMOTE}:' is not set up yet."
  echo "Run once:  rclone config   (create an SMB remote named '${REMOTE}')"
  exit 1
fi

# --- 3. Pull the latest files from the network share -----------------------
echo "==> Syncing  ${REMOTE}:${REMOTE_PATH}  ->  ${LOCAL_DIR}"
mkdir -p "$LOCAL_DIR"
if ! rclone copy "${REMOTE}:${REMOTE_PATH}" "$LOCAL_DIR" -P; then
  echo "ERROR: could not pull files from ${REMOTE}:${REMOTE_PATH}"
  echo "Check that IBM is on, on the same WiFi, and the share path is correct."
  exit 1
fi

cd "$LOCAL_DIR" || exit 1

# --- 4. Install Python dependencies if present -----------------------------
if [ -f requirements.txt ]; then
  echo "==> Installing Python dependencies ..."
  pip3 install -r requirements.txt
fi

# --- 5. Launch the app (native window, no VNC) -----------------------------
if [ ! -f "$APP" ]; then
  echo ""
  echo "ERROR: '$APP' not found in $LOCAL_DIR"
  echo "Files present:"
  ls -1
  echo "Re-run with the real name:  APP_FILE=your_file.py bash stockflow-sync-run-pixel.sh"
  exit 1
fi

echo "==> Launching $APP ..."
python3 "$APP" "$@"
