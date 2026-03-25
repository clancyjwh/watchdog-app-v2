import re

def find_unbalanced_brace():
    with open('src/pages/Onboarding.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # First revert the 4 extra </div> I just added
    if '</div>\n  </div>\n  </div>\n  </div>\n' in "".join(lines):
        print("Reverting extra </div> tags")
        content = "".join(lines).replace('  </div>\n  </div>\n  </div>\n  </div>\n   );\n}\n', '  );\n}\n')
        with open('src/pages/Onboarding.tsx', 'w', encoding='utf-8') as f:
            f.write(content)
        lines = content.splitlines(True)

    s = 0
    in_comment = False
    for i, line in enumerate(lines):
        # very basic comment stripping for just counting
        # ignore // comments
        clean_line = re.sub(r'//.*', '', line)
        for char in clean_line:
            if char == '{':
                s += 1
            elif char == '}':
                s -= 1
        print(f"Line {i+1:04d}: Sum = {s} | {line.strip()[:60]}")
        if s < 0:
            print(f"FAILED AT LINE {i+1}")
            break

find_unbalanced_brace()
