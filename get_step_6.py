import re

def get_step_6():
    with open('old_onboarding.tsx', 'r', encoding='utf-16') as f:
        text = f.read()

    start_idx = text.find('{currentStep === 6 && (')
    if start_idx == -1:
        print("Could not find step 6")
        return
        
    s = 0
    in_block = False
    
    end_idx = -1
    for i in range(start_idx, len(text)):
        if text[i] == '{':
            s += 1
            in_block = True
        elif text[i] == '}':
            s -= 1
            
        if in_block and s == 0:
            end_idx = i + 1
            break
            
    print(text[start_idx:end_idx])

get_step_6()
