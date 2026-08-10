#!/data/data/com.termux/files/usr/bin/bash
#
# Stockflow: network sync + run (Termux + VNC/XFCE)
# -------------------------------------------------
# Pulls the app folder from a network share (e.g. the IBM PC) using rclone,
# then runs the Python app on the phone. No manual file-manager copying.
#
# ONE-TIME SETUP (configures IBM's address + login, stored on the phone only):
#     pkg install rclone -y
#     rclone config
#       -> n (new remote)
#       -> name it:  ibm
#       -> storage type:  smb
#       -> host:  <IBM's IP, e.g. 192.168.1.42>
#       -> user:  <Windows username>
#       -> pass:  <Windows password>   (choose "y" to type it)
#       -> accept defaults for the rest, then q to quit
#
# THEN, every time you want to run the app:
#     bash stockflow-sync-run.sh
#
# Credentials live only in rclone's config on your phone -- never in this repo.

set -u

# --- Config (override via environment or ~/.stockflow.conf) ---------------
REMOTE="${STOCKFLOW_REMOTE:-ibm}"                              # rclone remote name
REMOTE_PATH="${STOCKFLOW_REMOTE_PATH:-00_Stockflow_Export}"    # share/subfolder to pull
LOCAL_DIR="${STOCKFLOW_LOCAL:-$HOME/00_Stockflow_Export}"      # where it lands on the phone
APP="${APP_FILE:-05_launch_metadata.py}"                       # Python entry point
GEOMETRY="${STOCKFLOW_GEOMETRY:-1600x900}"                     # VNC desktop size

# Optional per-phone overrides without editing this file:
[ -f "$HOME/.stockflow.conf" ] && . "$HOME/.stockflow.conf"

# --- 1. Route GUI windows to the VNC desktop -------------------------------
export DISPLAY=:1
if ! vncserver -list 2>/dev/null | grep -q ":1"; then
  echo "==> Starting VNC desktop on :1 ..."
  vncserver -geometry "$GEOMETRY" :1 || true
fi

# --- 2. Make sure rclone is installed --------------------------------------
if ! command -v rclone >/dev/null 2>&1; then
  echo "==> Installing rclone ..."
  pkg install -y rclone
fi

# --- 3. Make sure the network remote is configured -------------------------
if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE}:"; then
  echo ""
  echo "ERROR: rclone remote '${REMOTE}:' is not set up yet."
  echo "Run this once to add IBM as an SMB remote:"
  echo "    rclone config      (create an SMB remote named '${REMOTE}')"
  echo "See the comment block at the top of this script for the exact answers."
  exit 1
fi

# --- 4. Pull the latest files from the network share -----------------------
echo "==> Syncing  ${REMOTE}:${REMOTE_PATH}  ->  ${LOCAL_DIR}"
mkdir -p "$LOCAL_DIR"
if ! rclone copy "${REMOTE}:${REMOTE_PATH}" "$LOCAL_DIR" -P; then
  echo "ERROR: could not pull files from ${REMOTE}:${REMOTE_PATH}"
  echo "Check that IBM is on, on the same WiFi, and the share path is correct."
  exit 1
fi

cd "$LOCAL_DIR" || exit 1

# --- 5. Install Python dependencies if present -----------------------------
if [ -f requirements.txt ]; then
  echo "==> Installing Python dependencies ..."
  pip install -r requirements.txt
fi

# --- 6. Launch the app -----------------------------------------------------
if [ ! -f "$APP" ]; then
  echo ""
  echo "ERROR: '$APP' not found in $LOCAL_DIR"
  echo "Files present:"
  ls -1
  echo "Re-run with the real name:  APP_FILE=your_file.py bash stockflow-sync-run.sh"
  exit 1
fi

echo "==> Launching $APP ..."
python "$APP" "$@"
