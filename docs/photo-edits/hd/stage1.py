import sys, numpy as np, cv2
from PIL import Image
from cfg import CFG
from labels import detect_curve, text_mask, redraw_border
from lama import inpaint
k=sys.argv[1]; C=CFG[k]
im=np.asarray(Image.open(C['src']).convert('RGB')).copy()
src=im.copy().astype(int)
H,W=im.shape[:2]
# 1. labels
for L in C['labels']:
    m=np.zeros((H,W),np.uint8)
    if L['kind']=='caps':
        c,_=detect_curve(im,L['guide'],L['xr']); m=text_mask(im,c,L['tx'],L['h'])
    else:
        x0,y0,x1,y1=L['banner']; m[y0:y1,x0:x1]=255
        r=im.astype(int); navy=((r[...,2]>r[...,0]+30)&(r[...,2]>r[...,1]+5)&(r.sum(-1)<450)).astype(np.uint8)
        roi=np.zeros_like(m); roi[y0-8:y1+8,x0-8:x1+8]=1
        m|=cv2.dilate(navy*roi*255,np.ones((7,7),np.uint8))
        m[y1+3:y1+8,:]=0; m[:y0-L.get('top',3),:]=0; m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    im=inpaint(im,m)
for L in C['labels']:
    if 'fix' in L:
        m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(L['fix'])],255); im=inpaint(im,m)
    if 'fix2' in L:
        m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(L['fix2'])],255); im=inpaint(im,m,box=(40,740,320,900))
for L in C['labels']:
    if 'redraw' in L:
        R=L['redraw']; c,_=detect_curve(im,R['guide'],R['xr']); im=redraw_border(im,c,R['xa'],R['xb'],R['rl'],R['rr'],up=3,down=12,feather=3)
# 2. olives / plaque
for poly in C.get('olives',[]):
    m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(poly)],255)
    m=cv2.dilate(m,np.ones((7,7),np.uint8))
    im=inpaint(im,m)
for poly in C.get('leafroi',[]):
    roi=np.zeros((H,W),np.uint8); cv2.fillPoly(roi,[np.array(poly)],1)
    r=src; g=((r[...,1]>=r[...,0]-2)&(r[...,1]>r[...,2]+12)).astype(np.uint8)
    g=cv2.morphologyEx(g,cv2.MORPH_OPEN,np.ones((2,2),np.uint8))
    m=roi*255 if C.get('solid',True) else cv2.dilate(g*roi*255,np.ones((9,9),np.uint8))&(roi*255)
    cv2.imwrite(f'work/{k}_leafmask{poly[0][0]}.png',m)
    im=inpaint(im,m)
Image.fromarray(im).save(f'work/{k}_s1.png')
