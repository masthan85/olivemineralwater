import sys, time, torch, numpy as np
from PIL import Image
from spandrel import ModelLoader
torch.set_num_threads(4)
m = ModelLoader().load_from_file('models/x4.pth').eval()
def up(img, tile=320, pad=16):
    x = torch.from_numpy(np.asarray(img.convert('RGB'), dtype=np.float32)/255.).permute(2,0,1)[None]
    _,_,H,W = x.shape; out = torch.zeros(1,3,H*4,W*4)
    with torch.inference_mode():
        for y0 in range(0,H,tile):
            for x0 in range(0,W,tile):
                y1,x1=min(y0+tile,H),min(x0+tile,W)
                ya,xa=max(y0-pad,0),max(x0-pad,0); yb,xb=min(y1+pad,H),min(x1+pad,W)
                o = m(x[:,:,ya:yb,xa:xb])
                out[:,:,y0*4:y1*4,x0*4:x1*4] = o[:,:,(y0-ya)*4:(y0-ya+y1-y0)*4,(x0-xa)*4:(x0-xa+x1-x0)*4]
    a = (out[0].clamp(0,1).permute(1,2,0).numpy()*255+0.5).astype(np.uint8)
    return Image.fromarray(a)
if __name__=='__main__':
    t=time.time(); im=up(Image.open(sys.argv[1])); im.save(sys.argv[2]); print(im.size, round(time.time()-t),'s')
