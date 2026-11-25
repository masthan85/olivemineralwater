import torch, numpy as np, cv2
torch.set_num_threads(4)
_m=None
def model():
    global _m
    if _m is None: _m=torch.jit.load('models/big-lama.pt',map_location='cpu').eval()
    return _m
def inpaint(img, mask, box=None, maxside=1024):
    """img HxWx3 uint8 RGB, mask HxW uint8 (255=fill). Inpaints within box (x0,y0,x1,y1) crop."""
    H,W=mask.shape
    if box is None:
        ys,xs=np.nonzero(mask); m=64
        box=(max(0,xs.min()-m),max(0,ys.min()-m),min(W,xs.max()+m),min(H,ys.max()+m))
    x0,y0,x1,y1=box
    ci=img[y0:y1,x0:x1]; cm=mask[y0:y1,x0:x1]
    h,w=cm.shape; s=min(1.0,maxside/max(h,w))
    if s<1: ri=cv2.resize(ci,(int(w*s),int(h*s)),interpolation=cv2.INTER_AREA); rm=cv2.resize(cm,(int(w*s),int(h*s)),interpolation=cv2.INTER_NEAREST)
    else: ri,rm=ci,cm
    rh,rw=rm.shape; ph,pw=(8-rh%8)%8,(8-rw%8)%8
    ri=np.pad(ri,((0,ph),(0,pw),(0,0)),mode='reflect'); rm=np.pad(rm,((0,ph),(0,pw)),mode='constant')
    ti=torch.from_numpy(ri).permute(2,0,1)[None].float()/255.; tm=(torch.from_numpy(rm)[None,None].float()>127).float()
    with torch.inference_mode(): o=model()(ti,tm)
    o=(o[0].permute(1,2,0).clamp(0,1).numpy()*255).astype(np.uint8)[:rh,:rw]
    if s<1: o=cv2.resize(o,(w,h),interpolation=cv2.INTER_CUBIC)
    out=img.copy(); mm=(cm>127)
    # feather blend
    a=cv2.GaussianBlur(mm.astype(np.float32),(0,0),1.2); a=np.maximum(a,mm)[...,None]
    out[y0:y1,x0:x1]=(o*a+ci*(1-a)).astype(np.uint8)
    return out
