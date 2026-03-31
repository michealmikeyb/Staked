import { useState } from 'react';

export function useShare() {
  const [toastVisible, setToastVisible] = useState(false);

  const share = (title: string, url: string) => {
    if (navigator.share) {
      navigator.share({ title, url });
    } else {
      navigator.clipboard.writeText(url);
      setToastVisible(true);
    }
  };

  return { share, toastVisible, setToastVisible };
}
