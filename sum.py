def print_sums(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    s = 0
    for i, line in enumerate(lines):
        # Ignore comments
        line = line.split('//')[0]
        s += line.count('{')
        s -= line.count('}')
        if s == 1 and line.strip() == '':
            # end of a balanced block usually? No, at s=0 it's balanced
            pass
            
        print(f"{i+1:04d}: {s:3d} | {line.rstrip()}")

print_sums('src/pages/Onboarding.tsx')
