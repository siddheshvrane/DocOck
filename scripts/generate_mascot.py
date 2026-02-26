import sys
from PIL import Image

def hex_color(rgba):
    return '#{:02x}{:02x}{:02x}'.format(*rgba[:3])

img = Image.open(r"c:\Users\Vinay\OneDrive\Desktop\Siddhesh_projects\DocOc\frontend\src\assets\mascot.png").convert("RGBA")
grid_size = 64
img_small = img.resize((grid_size, grid_size), resample=Image.NEAREST)

rects = []
for y in range(grid_size):
    x = 0
    while x < grid_size:
        col = img_small.getpixel((x, y))
        
        if col[3] > 50:
            run = 1
            while x + run < grid_size:
                next_col = img_small.getpixel((x + run, y))
                if next_col == col:
                    run += 1
                else:
                    break
            
            hx = hex_color(col)
            opacity = col[3] / 255.0
            fill_str = hx
            
            cls = ''
            if (hx in ['#6c3619', '#70381a', '#5c2d15', '#8a4521', '#412211', '#3b1c11', '#000000', '#3f2112'] or (col[0]<100 and col[1]<80 and col[2]<80)):
                if 0.3 * grid_size < x < 0.7 * grid_size and 0.3 * grid_size < y < 0.6 * grid_size:
                    cls = ' className="mascot-eye"'
            
            # Heuristic for arms: orange/reddish pixels on the far left and right edges
            if not cls and (hx in ['#f15a24', '#f7931e', '#ea5621', '#d44919', '#f26532', '#f36e3b'] or (col[0]>200 and col[1]<150 and col[2]<80)):
                if 0.05 * grid_size < x < 0.25 * grid_size and 0.5 * grid_size < y < 0.8 * grid_size:
                    cls = ' className="mascot-left-arm"'
                elif 0.75 * grid_size < x < 0.95 * grid_size and 0.5 * grid_size < y < 0.8 * grid_size:
                    cls = ' className="mascot-right-arm"'
                    
            op_str = f' opacity="{opacity:.2f}"' if opacity < 1.0 else ''
            line = f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{fill_str}"{op_str}{cls}/>'
            rects.append(line)
            x += run
        else:
            x += 1

out = f'''import React from 'react';

export default function PixelMascot({{ className }}) {{
  return (
    <div className={{`relative ${{className}}`}}>
      <style>
        {{`
          @keyframes eye-blink {{
            0%, 96%, 100% {{ transform: scaleY(1); }}
            98% {{ transform: scaleY(0.1); }}
          }}
          .mascot-eye {{
            transform-origin: center;
            transform-box: fill-box;
            animation: eye-blink 5s infinite;
          }}
          @keyframes left-arm-swing {{
            0%, 100% {{ transform: rotate(0deg); }}
            50% {{ transform: rotate(10deg); }}
          }}
          @keyframes right-arm-swing {{
            0%, 100% {{ transform: rotate(0deg); }}
            50% {{ transform: rotate(-10deg); }}
          }}
          .mascot-left-arm {{
            transform-origin: top right;
            transform-box: fill-box;
            animation: left-arm-swing 4s ease-in-out infinite;
          }}
          .mascot-right-arm {{
            transform-origin: top left;
            transform-box: fill-box;
            animation: right-arm-swing 4s ease-in-out infinite;
          }}
          @keyframes breathing-body {{
            0%, 100% {{ transform: scaleY(1); }}
            50% {{ transform: scaleY(1.02); }}
          }}
          svg {{
            transform-origin: bottom center;
            animation: breathing-body 4s ease-in-out infinite;
          }}
        `}}
      </style>
      <svg viewBox="0 0 {grid_size} {grid_size}" className="w-full h-full" shapeRendering="crispEdges">
        {"".join(rects)}
      </svg>
    </div>
  );
}}
'''

with open(r"c:\Users\Vinay\OneDrive\Desktop\Siddhesh_projects\DocOc\frontend\src\components\PixelMascot.jsx", "w", encoding="utf-8") as f:
    f.write(out)
print("Done writing PixelMascot.jsx")
