import {ResourceLoader} from './imageviewer.model';
import {ImageCacheService} from './imagecache.service';
import {PDFDocumentProxy, PDFPageProxy} from 'pdfjs-dist';

declare var pdfjsLib: any;
declare var pdfjsWorker: any;

export class PdfResourceLoader extends ResourceLoader {
  private _pdf: PDFDocumentProxy;
  private _page: PDFPageProxy;
  private _pendingReload: boolean;

  constructor(private _imageCache: ImageCacheService) {
    super();
    if (typeof window !== 'undefined' && 'Worker' in window) {
      if (pdfjsLib && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
      }
    }
    this.showItemsQuantity = true;
  }

  setUp() {
    if (this.loading || !this.src) {
      return;
    }
    const loadingTask = pdfjsLib.getDocument(this.src);
    this.loading = true;
    this.currentItem = 1;
    loadingTask.promise.then((pdf: PDFDocumentProxy) => {
      this._pdf = pdf;
      this.totalItem = pdf.numPages;
      this.loaded = true;
      this.loadResource();
    }, (reason: string) => {
      console.error(reason);
    });
  }

  loadResource() {
    if (!this.loaded) {
      this._pendingReload = true;
      return;
    }
    this.loaded = false;
    const url = this.src;
    const page = this.currentItem;

    this._pdf.getPage(page).then((pdfPage) => {
      this._page = pdfPage;
      this.loadImage(url, page, () => {
        this.loaded = true;
        this.type = 'pdf';
        this.loading = false;
        if (this._pendingReload) {
          this._pendingReload = false;
          this.loadResource();
        } else {
          this.resourceChange.next();
        }
      });
    });
  }

  private loadImage(src: string, page: number, onFinish: () => void) {
    const cacheimg = this._imageCache.getImage(src, page);
    if (cacheimg) {
      this._image = cacheimg;
      onFinish();
      return;
    }

    const canvas: HTMLCanvasElement = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const pageVp = this._page.getViewport({scale: 1});

    canvas.width = pageVp.width;
    canvas.height = pageVp.height;

    const renderContext = {
      canvasContext: context,
      viewport: pageVp
    };


    this._page.render(renderContext).promise.then(() => {
      canvas.toBlob(blob => {
        const img = new Image();
        img.onload = onFinish;
        img.src = URL.createObjectURL(blob);
        this._imageCache.saveImage(src, page, img);
        this._image = img;
      });
    });
  }
}
