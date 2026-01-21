# Install python
## Window
- Vào [python.org/downloads](https://www.python.org/downloads/) tải bản mới nhất (khuyên dùng Python 3.11 hoặc 3.12).
- Trong quá trình cài đặt nhớ tick `Add Python to PATH` để có thể chạy lệnh python từ Command Prompt.
## Ubuntu
```
python3 --version
```
```
sudo apt install python3 -y
```
```
sudo apt install python3-pip -y
```
# Install library
Window
```
pip install requests pandas openpyxl python-dotenv
```
Ubuntu
```
sudo apt install python3-requests python3-pandas python3-openpyxl python3-dotenv python3-tqdm
```

# Run
## Window
```
python fetch_prs_list.py
```
## Ubuntu
```shell
python3 fetch_prs_list.py
```
```shell
python3 fetch_prs_list_process.py
```
```shell
python3 fetch_prs_list_process_all.py
```
