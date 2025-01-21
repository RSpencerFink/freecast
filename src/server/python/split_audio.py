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
        # Create a request with headers that mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req) as response:
            with open(temp.name, 'wb') as out_file:
                out_file.write(response.read())
        return temp.name
    except Exception as e:
        if os.path.exists(temp.name):
            os.unlink(temp.name)
        if isinstance(e, urllib.error.HTTPError) and e.code == 403:
            raise Exception("Access forbidden. The URL might require authentication or doesn't allow direct downloads")
        raise Exception(f"Failed to download file: {str(e)}")

def split_audio(input_file, max_size_mb=24):
    output_files = []
    temp_file = None
    
    try:
        # If input is a URL, download it first
        if input_file.startswith(('http://', 'https://')):
            temp_file = download_file(input_file)
            input_file = temp_file
        elif not os.path.exists(input_file):
            raise Exception(f"Input file not found: {input_file}")

        # Load the audio file
        audio = AudioSegment.from_mp3(input_file)
        
        # Calculate file size per second (in MB)
        file_size = os.path.getsize(input_file) / (1024 * 1024)  # Convert to MB
        duration_sec = len(audio) / 1000  # Convert ms to sec
        mb_per_sec = file_size / duration_sec
        secs_per_chunk = max_size_mb / mb_per_sec
        total_chunks = math.ceil(duration_sec / secs_per_chunk)
        
        # Split the file
        for i in range(total_chunks):
            start_sec = i * secs_per_chunk * 1000  # Convert to ms
            end_sec = min((i + 1) * secs_per_chunk * 1000, len(audio))
            
            chunk = audio[start_sec:end_sec]
            output_filename = f"{os.path.splitext(input_file)[0]}_part{i+1}.mp3"
            chunk.export(output_filename, format="mp3")
            if output_filename not in output_files:  # Prevent duplicates
                output_files.append(output_filename)
                print(output_filename)

    finally:
        # Clean up temporary file if it exists
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)
    
    return output_files

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 split_audio.py <input_file_or_url>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    result = split_audio(input_file)
    # Print the array as a string that can be parsed by JavaScript
    print("\n".join(result))

