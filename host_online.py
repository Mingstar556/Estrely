import os
import sys
import time
import re
import subprocess
import webbrowser
import socket

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    app_py = os.path.join(root_dir, 'server', 'python', 'app.py')
    cloudflared = os.path.join(root_dir, 'cloudflared.exe')

    if not os.path.exists(cloudflared):
        print(f"[!] cloudflared.exe not found at {cloudflared}")
        print("Please ensure cloudflared.exe is in the project folder.")
        sys.exit(1)

    print("=" * 64)
    print(" ⭐ ESTRELY - LIVE INTERNET HOSTING FROM YOUR LAPTOP ⭐")
    print("=" * 64)

    # 1. Start Python backend
    print("\n[1/3] Starting backend server on your laptop (port 5000)...")
    server_process = subprocess.Popen(
        [sys.executable, app_py],
        cwd=os.path.join(root_dir, 'server', 'python'),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    time.sleep(2)

    # 2. Start Cloudflare Tunnel
    print("[2/3] Broadcasting your website to the public internet...")
    tunnel_process = subprocess.Popen(
        [cloudflared, 'tunnel', '--url', 'http://127.0.0.1:5000'],
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

    local_ip = get_local_ip()

    if public_url:
        print("*" * 64)
        print("  🎉 ESTRELY IS NOW LIVE ON THE INTERNET!")
        print("*" * 64)
        print("\n  👉 PUBLIC LINK (Share with anyone on Phone or PC anywhere):")
        print(f"     {public_url}")
        print(f"\n  👉 LOCAL WI-FI LINK (Devices on your same home Wi-Fi):")
        print(f"     http://{local_ip}:5000")
        print("\n" + "-" * 64)
        print("  • Anyone opening the public link can chat with Estrely immediately.")
        print("  • No downloads, accounts, or installations needed for visitors.")
        print("  • Keep this window OPEN while you want your site accessible.")
        print("  • Press Ctrl+C in this window anytime to stop hosting.")
        print("*" * 64 + "\n")

        try:
            webbrowser.open(public_url)
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
