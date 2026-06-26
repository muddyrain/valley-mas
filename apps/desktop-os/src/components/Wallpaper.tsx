import './Wallpaper.css';
import { getWallpaperOption, useDesktopPreferencesStore } from '../store/desktopPreferencesStore';

export default function Wallpaper() {
  const wallpaperId = useDesktopPreferencesStore((s) => s.wallpaperId);
  const wallpaper = getWallpaperOption(wallpaperId);

  return (
    <div className={`wallpaper wallpaper--${wallpaper.kind}`}>
      {wallpaper.kind === 'image' ? (
        <img className="wallpaper__image" src={wallpaper.source} alt="" />
      ) : (
        <>
          <div className="wallpaper__sky" />
          <div className="wallpaper__cloud wallpaper__cloud--1" />
          <div className="wallpaper__cloud wallpaper__cloud--2" />
          <div className="wallpaper__cloud wallpaper__cloud--3" />
          <div className="wallpaper__hill" />
          <div className="wallpaper__ground" />
        </>
      )}
    </div>
  );
}
