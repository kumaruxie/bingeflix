import os
import base64
from PIL import Image

logo_path = r'C:\Users\kumar\.gemini\antigravity-ide\brain\334a845c-15a2-491a-bba1-6449b5bf791e\scratch\axon_a_512_trans.png'
emblem_512 = Image.open(logo_path)

# Prepare 128x128 for SVG and Favicon
emblem_128 = emblem_512.resize((128, 128), Image.Resampling.LANCZOS)
emblem_128_path = r'C:\Users\kumar\.gemini\antigravity-ide\brain\334a845c-15a2-491a-bba1-6449b5bf791e\scratch\favicon_128.png'
emblem_128.save(emblem_128_path, format='PNG')

with open(emblem_128_path, 'rb') as f:
    b64_str = base64.b64encode(f.read()).decode('utf-8')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <filter id="red-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <image href="data:image/png;base64,{b64_str}" width="128" height="128" filter="url(#red-glow)" />
</svg>
'''

# Multi-resolution ICO
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_path = r'C:\Users\kumar\.gemini\antigravity-ide\brain\334a845c-15a2-491a-bba1-6449b5bf791e\scratch\favicon.ico'
emblem_512.save(ico_path, format='ICO', sizes=ico_sizes)

root_dir = r'a:\movies app'
web_dirs = [
    root_dir,
    os.path.join(root_dir, 'public'),
    os.path.join(root_dir, 'dist'),
    os.path.join(root_dir, 'docs')
]

for d in web_dirs:
    os.makedirs(d, exist_ok=True)
    emblem_512.save(os.path.join(d, 'favicon.png'), format='PNG')
    emblem_512.save(os.path.join(d, 'logo.png'), format='PNG')
    emblem_512.save(os.path.join(d, 'logo-transparent.png'), format='PNG')
    with open(os.path.join(d, 'favicon.ico'), 'wb') as f_out, open(ico_path, 'rb') as f_in:
        f_out.write(f_in.read())
    with open(os.path.join(d, 'favicon.svg'), 'w', encoding='utf-8') as f_svg:
        f_svg.write(svg_content)

print('Web directories updated with new AXON A logo!')

# Update Android Mipmap icons
android_res = os.path.join(root_dir, 'android', 'app', 'src', 'main', 'res')
if os.path.exists(android_res):
    densities = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432)
    }
    for folder, (std_size, fg_size) in densities.items():
        target_folder = os.path.join(android_res, folder)
        if os.path.exists(target_folder):
            # 1. Standard icon (on dark squircle)
            bg = Image.new('RGBA', (std_size, std_size), (14, 18, 27, 255))
            em_scaled = emblem_512.resize((int(std_size * 0.85), int(std_size * 0.85)), Image.Resampling.LANCZOS)
            offset = (int((std_size - em_scaled.width)/2), int((std_size - em_scaled.height)/2))
            bg.paste(em_scaled, offset, em_scaled)
            bg.save(os.path.join(target_folder, 'ic_launcher.png'), format='PNG')
            bg.save(os.path.join(target_folder, 'ic_launcher_round.png'), format='PNG')
            
            # 2. Foreground icon (transparent for adaptive icons)
            fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
            fg_em = emblem_512.resize((int(fg_size * 0.72), int(fg_size * 0.72)), Image.Resampling.LANCZOS)
            fg_offset = (int((fg_size - fg_em.width)/2), int((fg_size - fg_em.height)/2))
            fg.paste(fg_em, fg_offset, fg_em)
            fg.save(os.path.join(target_folder, 'ic_launcher_foreground.png'), format='PNG')

    print('Android launcher icons updated with new AXON A logo!')
