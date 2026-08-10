import os
import sys
import json
import requests
import subprocess
import time
from datetime import datetime

# ==========================================
# KONFIGURASI FASTORY ENGINE
# ==========================================
SERVER_URL = os.environ.get("FASTORY_SERVER_URL", "http://localhost:3000")
API_GENERATE = f"{SERVER_URL}/api/generate"
API_HEALTH = f"{SERVER_URL}/api/health"

def check_server_health():
    """Memastikan server backend (server.ts) sedang berjalan dengan mekanisme retry."""
    print("🔍 Checking FASTORY Engine server health...")
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(API_HEALTH, timeout=5)
            if response.status_code == 200:
                print("🟢 Engine Server online dan siap!")
                return True
            else:
                print(f"🔴 Server merespons dengan status code: {response.status_code}")
        except requests.exceptions.RequestException:
            print(f"⏳ Menunggu server aktif (Percobaan {attempt}/{max_retries})...")
            time.sleep(3)
    
    print("❌ Server belum aktif di http://localhost:3000.")
    print("💡 Jalankan server terlebih dahulu di terminal lain dengan: npm run dev (lokal) atau npm start (CI)")
    return False

def trigger_story_generation(snippet=None, target_length=1500, cover_url=None):
    """Memicu API pembuatan cerita di FASTORY Engine."""
    print("🚀 Memulai alur pembuatan cerita otomatis...")
    
    payload = {
        "customSnippet": snippet or "A new chapter unfolds with unexpected twists.",
        "targetLength": target_length,
        "coverUrl": cover_url or ""
    }
    
    try:
        response = requests.post(API_GENERATE, json=payload, timeout=15)
        if response.status_code == 200:
            print("✅ Pipeline produksi cerita berhasil dipicu!")
            msg = response.json().get('message', 'Processing started.')
            print(f"📩 Respon Server: {msg}")
            return True
        else:
            print(f"❌ Gagal memicu produksi: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Terjadi kesalahan saat memanggil API: {e}")
        return False

def auto_git_commit_and_push(story_title="auto-generated-episode"):
    """Meng-commit hasil pembuatan cerita baru dan mengunduhnya ke GitHub Repo."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    commit_message = f"chore(story): Auto-produce {story_title} [{timestamp}]"

    print("\n📦 Memproses Git auto-commit & push...")
    try:
        subprocess.run(["git", "add", "."], check=True)
        
        result = subprocess.run(["git", "commit", "-m", commit_message], capture_output=True, text=True)
        if "nothing to commit" in result.stdout:
            print("ℹ️ Tidak ada perubahan cerita baru yang perlu di-commit.")
            return

        print(f"📝 Commit berhasil: '{commit_message}'")

        print("🚀 Pushing perubahan ke GitHub (memicu GitHub Actions)...")
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("🟢 Push sukses! GitHub Actions Workflow otomatis ter-trigger.")

    except subprocess.CalledProcessError as e:
        print(f"❌ Terjadi kesalahan pada perintah Git: {e}")

def main():
    print("=" * 60)
    print("      FASTORY ENGINE - PYTHON AUTOMATION PRODUCER      ")
    print("=" * 60)

    # Detect lingkungan GitHub Actions
    is_ci = os.environ.get("GITHUB_ACTIONS") == "true"

    # 1. Cek kesehatan server
    if not check_server_health():
        sys.exit(1)

    # 2. Memicu produksi cerita berdasarkan mode eksekusi
    if is_ci:
        print("🤖 Menjalankan dalam mode otomatis (GitHub Actions)...")
        custom_snippet = "Automated daily story chapter generation."
        success = trigger_story_generation(snippet=custom_snippet, target_length=1500)
        if success:
            print("⏳ Menunggu proses generasi cerita selesai (15 detik)...")
            time.sleep(15)
    else:
        custom_snippet = input("\n📝 Masukkan Prompt/Snippet tambahan (Tekan Enter untuk default): ").strip()
        success = trigger_story_generation(
            snippet=custom_snippet if custom_snippet else None,
            target_length=1500
        )

        if success:
            print("\n⏳ Menunggu proses generasi selesai (10 detik)...")
            time.sleep(10)
            
            auto_push = input("\n📤 Apakah ingin langsung commit & push ke GitHub? (y/n): ").strip().lower()
            if auto_push == 'y':
                auto_git_commit_and_push()

if __name__ == "__main__":
    main()