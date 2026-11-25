import numpy as np, cv2
def lum(img): return img[...,0]*0.3+img[...,1]*0.59+img[...,2]*0.11

def detect_curve(img, guide, xr, tol=10, skip=None, sign=1):
    """Inner (top) edge of the label's bottom gold border.
    guide: 3 (x,y) points; xr=(x0,x1) columns used; skip=list of (xa,xb) to ignore."""
    L=cv2.GaussianBlur(lum(img.astype(np.float32)),(0,0),0.8)
    gx=np.array([p[0] for p in guide],float); gy=np.array([p[1] for p in guide],float)
    gc=np.polyfit(gx,gy,2)
    pts=[]
    for x in range(xr[0],xr[1]+1):
        if skip and any(a<=x<=b for a,b in skip): continue
        yg=int(round(np.polyval(gc,x))); best=None
        for y in range(yg-tol,yg+tol+1):
            s=sign*(L[y+1:y+4,x].mean()-L[y-3:y,x].mean())
            if best is None or s>best[0]: best=(s,y)
        if best[0]>12: pts.append((x,best[1]+0.5))
    pts=np.array(pts)
    c=np.polyfit(pts[:,0],pts[:,1],2)
    for _ in range(3):
        r=np.abs(np.polyval(c,pts[:,0])-pts[:,1]); keep=r<max(1.5,np.percentile(r,70))
        c=np.polyfit(pts[keep,0],pts[keep,1],2)
    return c, pts

def text_mask(img, c, xr, h, gap=2, thr=14, dil=2):
    H,W=img.shape[:2]; L=lum(img.astype(np.float32))
    bg=cv2.medianBlur(np.clip(L,0,255).astype(np.uint8),21).astype(np.float32)
    band=np.zeros((H,W),np.uint8)
    for x in range(xr[0],xr[1]+1):
        yc=np.polyval(c,x); band[int(yc-h):int(yc-gap),x]=1
    m=((np.abs(L-bg)>thr)&(band>0)).astype(np.uint8)*255
    m=cv2.dilate(m,np.ones((2*dil+1,2*dil+1),np.uint8))
    return m&(band*255)

def redraw_border(img, c, xa, xb, ref_l, ref_r, up=6, down=10, feather=3):
    """Copy the border's vertical profile (relative to the curve) from clean columns into xa..xb."""
    out=img.astype(np.float32).copy(); H=img.shape[0]; yy=np.arange(H)
    dys=np.arange(-up-feather,down+feather+1).astype(float)
    def prof(xs):
        ps=[]
        for x in xs:
            yc=np.polyval(c,x)
            ps.append(np.stack([np.interp(dys+yc,yy,img[:,x,k].astype(np.float32)) for k in range(3)],1))
        return np.median(ps,0)
    pl=prof(range(ref_l-8,ref_l+1)); pr=prof(range(ref_r,ref_r+9))
    for x in range(xa,xb+1):
        t=(x-xa)/max(1,xb-xa); p=pl*(1-t)+pr*t; yc=np.polyval(c,x)
        for y in range(int(np.floor(yc-up-feather)),int(np.ceil(yc+down+feather))+1):
            dy=y-yc
            v=np.array([np.interp(dy,dys,p[:,k]) for k in range(3)])
            a=1.0
            if dy<-up: a=max(0,1-(-up-dy)/feather)
            if dy>down: a=max(0,1-(dy-down)/feather)
            out[y,x]=out[y,x]*(1-a)+v*a
    return np.clip(out,0,255).astype(np.uint8)
