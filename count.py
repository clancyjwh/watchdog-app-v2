def find_unclosed(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    i = 0
    in_line_comment = False
    in_block_comment = False
    in_str = False
    str_char = ''
    in_template = False
    
    while i < len(content):
        c = content[i]
        
        if in_line_comment:
            if c == '\n':
                in_line_comment = False
            i += 1
            continue
            
        if in_block_comment:
            if c == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue
            
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == str_char:
                in_str = False
            i += 1
            continue
            
        if in_template:
            if c == '\\':
                i += 2
                continue
            if c == '`':
                in_template = False
            elif c == '$' and i + 1 < len(content) and content[i+1] == '{':
                line_num = content[:i].count('\n') + 1
                stack.append(('${', line_num))
                i += 2
                continue
            i += 1
            continue
            
        if c == '/' and i + 1 < len(content):
            if content[i+1] == '/':
                in_line_comment = True
                i += 2
                continue
            elif content[i+1] == '*':
                in_block_comment = True
                i += 2
                continue
                
        if c in ['\"', '\'']:
            in_str = True
            str_char = c
            i += 1
            continue
            
        if c == '`':
            in_template = True
            i += 1
            continue
            
        if c == '{':
            line_num = content[:i].count('\n') + 1
            stack.append(('{', line_num))
        elif c == '}':
            if stack:
                stack.pop()
            else:
                line_num = content[:i].count('\n') + 1
                print(f"Unexpected }} at line {line_num}")
                
        i += 1
        
    for item in stack:
        print(f"Unclosed {item[0]} from line {item[1]}")

find_unclosed('src/pages/Onboarding.tsx')
