import os
import sys
import time
import re
import subprocess
import webbrowser
import socket
import threading
import urllib.request

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def drain_pipe(proc):
    """Continuously drain stdout so the OS buffer never fills up and freezes cloudflared."""
    try:
        for _ in iter(proc.stdout.readline, ''):
            pass
    except Exception:
        pass

def wait_for_server(port=5000, timeout=10):
    """Ensure local python backend is accepting HTTP requests."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    app_py = os.path.join(root_dir, 'server', 'python', 'app.py')
    cloudflared = os.path.join(root_dir, 'cloudflared.exe')

    if not os.path.exists(cloudflared):
        print(f"[!] cloudflared.exe not found at {cloudflared}")
        print("Please ensure cloudflared.exe is in the project folder.")
        sys.exit(1)

    print("=" * 64)
    print("  ESTRELY - HIGH-SPEED LIVE INTERNET HOSTING")
    print("=" * 64)

    # 1. Start Python backend
    print("\n[1/3] Starting backend server on your laptop (port 5000)...")
    server_process = subprocess.Popen(
        [sys.executable, app_py],
        cwd=os.path.join(root_dir, 'server', 'python'),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    # Verify local backend is responding
    if not wait_for_server(5000, timeout=8):
        print("[!] Backend server took longer to start, continuing...")
    else:
        print("      [OK] Local server online & healthy.")

    # 2. Start Cloudflare Tunnel with HTTP/2 TCP acceleration
    print("[2/3] Broadcasting website to Cloudflare global edge (HTTP/2 accelerated)...")
    tunnel_process = subprocess.Popen(
        [cloudflared, 'tunnel', '--protocol', 'http2', '--edge-ip-version', 'auto', '--url', 'http://127.0.0.1:5000'],
        cwd=root_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace'
    )

    # 3. Read output to extract public URL
    print("[3/3] Generating your secure public HTTPS link...\n")
    public_url = None
    start_time = time.time()
    for line in iter(tunnel_process.stdout.readline, ''):
        match = re.search(r'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)', line)
        if match:
            public_url = match.group(1)
            break
        if time.time() - start_time > 30:
            break

    # Start background thread to keep stdout drained so cloudflared never hangs
    drain_thread = threading.Thread(target=drain_pipe, args=(tunnel_process,), daemon=True)
    drain_thread.start()

    local_ip = get_local_ip()

    if public_url:
        github_pages_url = f"https://mingstar556.github.io/Estrely/?server={public_url}"

        print("*" * 68)
        print("  ESTRELY IS NOW LIVE ON THE INTERNET (FAST EDGE ROUTING)!")
        print("*" * 68)
        print("\n  -> PUBLIC FRONTEND LINK (GitHub Pages live with your server):")
        print(f"     {github_pages_url}")
        print("\n  -> DIRECT CLOUDFLARE TUNNEL LINK (Full-Stack direct to laptop):")
        print(f"     {public_url}")
        print("\n  -> LOCAL WI-FI LINK (Devices on your home Wi-Fi):")
        print(f"     http://{local_ip}:5000")
        print("\n" + "-" * 68)
        print("  * Anyone opening either link can chat with Estrely immediately.")
        print("  * Zero buffer deadlocks: background pipeline reader active.")
        print("  * Keep this window OPEN while you want your site accessible.")
        print("  * Press Ctrl+C in this window anytime to stop hosting.")
        print("*" * 68 + "\n")

        try:
            webbrowser.open(github_pages_url)
        except Exception:
            pass

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down server and tunnel...")
    else:
        print("[!] Could not retrieve public tunnel URL. Check your internet connection.")

    try:
        tunnel_process.terminate()
        server_process.terminate()
    except Exception:
        pass

if __name__ == '__main__':
    main()
