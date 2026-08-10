#!/data/data/com.termux/files/usr/bin/bash
#
# Termux VNC + XFCE one-shot setup
# --------------------------------
# Sets up a full Linux (XFCE) desktop inside Termux so you can run
# Python GUI apps (Tkinter / PyQt5) on an Android phone and view them
# through a VNC viewer app (AVNC / RealVNC) at localhost:5901.
#
# Run it with a single command in Termux:
#   curl -sL https://raw.githubusercontent.com/NmediaCloud/stockflow/claude/phone-local-network-access-1p6e6s/tools/termux-vnc-setup.sh | bash
#
# Safe to re-run any time.

set -u

GEOMETRY="${1:-1920x1080}"   # pass a resolution as the first arg, e.g. 1600x900

echo "==> [1/5] Enabling x11 repo + refreshing package lists..."
pkg install -y x11-repo
pkg update -y

echo "==> [2/5] Installing desktop + VNC + Python (may take a few minutes)..."
pkg install -y tigervnc xfce4 dbus python python-tkinter

echo "==> [3/5] Writing the VNC startup file (launches XFCE)..."
mkdir -p "$HOME/.vnc"
cat > "$HOME/.vnc/xstartup" <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
dbus-launch --exit-with-session xfce4-session
EOF
chmod +x "$HOME/.vnc/xstartup"

echo "==> [4/5] Stopping any old VNC servers..."
vncserver -kill :1 >/dev/null 2>&1 || true
vncserver -kill :2 >/dev/null 2>&1 || true

echo "==> [5/5] Starting a fresh VNC server on :1 (port 5901) at $GEOMETRY ..."
vncserver -geometry "$GEOMETRY" :1

echo ""
echo "======================================================"
echo "  Setup complete."
echo ""
echo "  Open your VNC viewer app (AVNC recommended) and connect to:"
echo "      Host: localhost"
echo "      Port: 5901"
echo "  Enter the VNC password you set the first time."
echo ""
echo "  You should see the XFCE desktop. To run a Python app,"
echo "  open a terminal inside XFCE (or use Termux) and run:"
echo "      python your_app.py"
echo ""
echo "  To restart the desktop later:"
echo "      vncserver -kill :1"
echo "      vncserver -geometry $GEOMETRY :1"
echo "======================================================"
