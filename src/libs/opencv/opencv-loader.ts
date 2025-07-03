let cv: any = null;
let openCVLoadPromise: Promise<void> | null = null;

/**
 * 전역 스코프에서 OpenCV.js가 로드될 때까지 기다립니다.
 * 한 번 로드되면 프로미스를 재사용하여 중복 실행을 방지합니다.
 * @param {string} [scriptUrl] - 로드할 OpenCV.js 스크립트의 URL. public 폴더에 있어야 합니다.
 */
export const waitForOpenCV = (scriptUrl: string = '/opencv.js'): Promise<void> => {
  if (openCVLoadPromise) return openCVLoadPromise;

  openCVLoadPromise = new Promise((resolve, reject) => {
    if ((window as any).cv && (window as any).cv.Mat) {
      cv = (window as any).cv;
      return resolve();
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      const timeout = 10000;
      const startTime = Date.now();
      const intervalId = setInterval(() => {
        if ((window as any).cv && (window as any).cv.Mat) {
          clearInterval(intervalId);
          cv = (window as any).cv;
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(intervalId);
          reject(new Error('OpenCV.js 로딩 시간 초과.'));
        }
      }, 100);
    };
    
    script.onerror = () => {
        reject(new Error('OpenCV.js 스크립트를 로드할 수 없습니다.'));
    }

    document.head.appendChild(script);
  });

  return openCVLoadPromise;
};

export { cv };