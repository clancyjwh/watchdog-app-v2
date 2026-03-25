import re

def count_divs(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    text = re.sub(r'//.*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    
    lines = text.split('\n')
    
    s = 0
    buffer = ""
    for i, line in enumerate(lines):
        buffer += line + "\n"
        open_tags = re.findall(r'<div\b[^>]*>', buffer)
        sc = sum(1 for d in open_tags if d.endswith('/>'))
        opens = len(open_tags) - sc
        closes = buffer.count('</div>')
        
        balance = opens - closes
        
        if 'currentStep ===' in line or 'currentStep <' in line:
            print(f"--- STEP START: Line {i+1} Balance: {balance} ---")
        elif ')}' in line and (balance == 2 or balance == 3 or balance == 4):
            print(f"--- BLOCK END?: Line {i+1} Balance: {balance} ---")

    print(f"FINAL BALANCE: {balance}")

count_divs('src/pages/Onboarding.tsx')
