#!/usr/bin/env python3
import sys
import os
import math
from pydub import AudioSegment
import urllib.request
import tempfile

def download_file(url):
    temp = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            with open(temp.name, 'wb') as out_file:
                out_file.write(response.read())
        return temp.name
    except Exception as e:
        os.unlink(temp.name)
        raise Exception(f"Failed to download file: {str(e)}")

def split_audio(input_file, max_size_mb=24):
    try:
        # If input is a URL, download it first
        if input_file.startswith('http'):
            temp_file = download_file(input_file)
            input_file = temp_file

        # Load the audio file
        audio = AudioSegment.from_mp3(input_file)
        
        # Calculate file size per second (in MB)
        file_size = os.path.getsize(input_file) / (1024 * 1024)  # Convert to MB
        duration_sec = len(audio) / 1000  # Convert ms to sec
        mb_per_sec = file_size / duration_sec
        
        # Calculate how many seconds can fit in max_size_mb
        secs_per_chunk = max_size_mb / mb_per_sec
        
        # Calculate number of chunks needed
        total_chunks = math.ceil(duration_sec / secs_per_chunk)
        
        # Split the file
        for i in range(total_chunks):
            start_sec = i * secs_per_chunk * 1000  # Convert to ms
            end_sec = min((i + 1) * secs_per_chunk * 1000, len(audio))
            
            # Extract chunk and export
            chunk = audio[start_sec:end_sec]
            output_filename = f"{os.path.splitext(input_file)[0]}_part{i+1}.mp3"
            chunk.export(output_filename, format="mp3")
            
            print(f"Created {output_filename}")

    finally:
        # Clean up temporary file if it exists
        if input_file.startswith('http'):
            try:
                os.unlink(temp_file)
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 split_audio.py <input_file_or_url>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    split_audio(input_file)

