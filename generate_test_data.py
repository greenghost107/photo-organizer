import os
import shutil

TEST_DIR = 'test_library'

def create_test_env():
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)
    os.makedirs(TEST_DIR)
    
    # 1. Unique file
    with open(os.path.join(TEST_DIR, 'unique.jpg'), 'wb') as f:
        f.write(os.urandom(1024 * 10)) # 10KB
        
    # 2. Duplicate pair (same size, same content)
    content1 = os.urandom(1024 * 20) # 20KB
    with open(os.path.join(TEST_DIR, 'photo1.jpg'), 'wb') as f:
        f.write(content1)
    with open(os.path.join(TEST_DIR, 'photo1_copy.jpg'), 'wb') as f:
        f.write(content1)
        
    # 3. Same size, different content (to test partial/full hashing)
    with open(os.path.join(TEST_DIR, 'diff1.jpg'), 'wb') as f:
        f.write(os.urandom(1024 * 30))
    with open(os.path.join(TEST_DIR, 'diff2.jpg'), 'wb') as f:
        f.write(os.urandom(1024 * 30))
        
    # 4. Duplicate group in subfolder
    sub = os.path.join(TEST_DIR, 'holiday_2024')
    os.makedirs(sub)
    content2 = os.urandom(1024 * 50)
    with open(os.path.join(sub, 'beach.mp4'), 'wb') as f:
        f.write(content2)
    with open(os.path.join(TEST_DIR, 'old_beach_backup.mp4'), 'wb') as f:
        f.write(content2)

    print(f"Test environment created at {os.path.abspath(TEST_DIR)}")

if __name__ == "__main__":
    create_test_env()
