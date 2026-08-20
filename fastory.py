import os
import sys
import json
import requests
import time

SERVER_URL = os.environ.get("FASTORY_SERVER_URL", "http://localhost:3000")
API_GENERATE = f"{SERVER_URL}/api/generate"
API_HEALTH = f"{SERVER_URL}/api/health"

def check_server_health():
    """Memastikan server backend berjalan."""
    print("🔍 Checking FASTORY Engine server health...")
    for attempt in range(1, 6):
        try:
            response = requests.get(API_HEALTH, timeout=5)
            if response.status_code == 200:
                print("🟢 Engine Server online dan siap!")
                return True
        except requests.exceptions.RequestException:
            print(f"⏳ Menunggu server aktif ({attempt}/5)...")
            time.sleep(3)
    
    print("❌ Server belum aktif di http://localhost:3000.")
    return False

def wait_until_processing_finished():
    """Memantau status server sampai proses AI & Google Drive Upload benar-benar tuntas."""
    print("⏳ Menunggu proses AI & Google Drive Delivery selesai tuntas...")
    max_wait_seconds = 180  # Dinaikkan jadi 3 menit untuk memberi jeda Auto-Retry Gemini
    start_time = time.time()
    
    # Buka jeda 5 detik pertama agar server sempat mengubah status isProcessing menjadi True
    time.sleep(5)

    while time.time() - start_time < max_wait_seconds:
        try:
            response = requests.get(API_HEALTH, timeout=5)
            if response.status_code == 200:
                data = response.json()
                scheduler_data = data.get("scheduler", {})
                
                is_processing = scheduler_data.get("isProcessing", False)
                last_error = scheduler_data.get("lastError", None)
                
                # Cek jika ada error fatal selama proses berlangsung
                if last_error:
                    print(f"❌ PROSES GAGAL DENGAN ERROR: {last_error}")
                    sys.exit(1) # Hentikan runner agar GitHub Actions tahu ada kegagalan
                
                if not is_processing:
                    print("✅ TUNTAS! Proses pembuatan cerita & pengiriman ke Google Drive selesai!")
                    return True
                else:
                    print("⚙️ AI masih merangkai cerita & mengunggah ke Google Drive... (menunggu 5d)")
        except Exception as e:
            print(f"⚠️ Warning saat cek status: {e}")
            
        time.sleep(5)

    print("❌ Waktu tunggu habis (Timeout). Proses gagal selesai tepat waktu!")
    sys.exit(1) # Hentikan runner jika timeout

def trigger_story_generation(snippet=None, target_length=1500):
    """Memicu API pembuatan cerita di FASTORY Engine."""
    print("🚀 Memulai alur pembuatan cerita otomatis...")
    
    payload = {
        "customSnippet": snippet or "A new chapter unfolds with unexpected twists.",
        "targetLength": target_length,
        "coverUrl": ""
    }
    
    try:
        response = requests.post(API_GENERATE, json=payload, timeout=15)
        if response.status_code == 200:
            print("✅ Pipeline produksi cerita berhasil dipicu!")
            return True
        else:
            print(f"❌ Gagal memicu produksi: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Terjadi kesalahan saat memanggil API: {e}")
        return False

def main():
    print("=" * 60)
    print("      FASTORY ENGINE - PYTHON AUTOMATION PRODUCER      ")
    print("=" * 60)

    if not check_server_health():
        sys.exit(1)

    is_ci = os.environ.get("GITHUB_ACTIONS") == "true"

    if is_ci:
        print("🤖 Menjalankan dalam mode otomatis (GitHub Actions)...")
        if trigger_story_generation(snippet="Automated daily story chapter.", target_length=1500):
            # TUNGGU SAMPAI BENAR-BENAR SELESAI UPLOAD GOOGLE DRIVE
            wait_until_processing_finished()
    else:
        custom_snippet = input("\n📝 Masukkan Prompt/Snippet tambahan (Enter untuk default): ").strip()
        if trigger_story_generation(
            snippet=custom_snippet if custom_snippet else None,
            target_length=1500
        ):
            wait_until_processing_finished()

if __name__ == "__main__":
    main()