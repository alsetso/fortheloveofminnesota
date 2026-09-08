import Image from 'next/image';
import Link from 'next/link';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="For the Love of Minnesota home">
            <Image src="/logo.png" alt="" width={40} height={40} />
            <span>For the Love of Minnesota</span>
          </Link>
          <Link href="/welcome" prefetch={false} className={styles.signIn}>Sign in</Link>
        </header>

        <main id="main-content">
          <section className={styles.hero} aria-labelledby="home-title">
            <div className={styles.intro}>
              <p className={styles.eyebrow}>A little closer to Minnesota</p>
              <h1 id="home-title">Love where<br />you live.</h1>
              <p className={styles.description}>
                The places, people, and everyday discoveries that make Minnesota home.
                Find your next favorite spot and feel more connected to what’s around you.
              </p>
              <div className={styles.actions}>
                <a href="#about" className={styles.primary}>Take a look <span aria-hidden="true">↓</span></a>
                <Link href="/feed" prefetch={false} className={styles.secondary}>Open the app <span aria-hidden="true">↗</span></Link>
              </div>
              <p className={styles.note}>Make yourself at home. Joining is always your choice.</p>
            </div>
            <div className={styles.photo}>
              <Image
                src="/splash.jpg"
                alt="A sunny walk with a golden retriever along a tree-lined Minnesota trail"
                fill
                priority
                sizes="(max-width: 700px) 100vw, 460px"
                className={styles.photoImage}
              />
              <p className={styles.caption}>There’s more to love, right here.</p>
            </div>
          </section>

          <section id="about" className={styles.about} aria-labelledby="about-title">
            <h2 id="about-title">Your state. Your community.</h2>
            <div className={styles.features}>
              <article><span className={styles.number}>01 / Discover</span><h3>Find a new favorite.</h3><p>Get to know the places and local gems that make every corner of Minnesota its own.</p></article>
              <article><span className={styles.number}>02 / Connect</span><h3>Feel a little more local.</h3><p>Stay close to community stories, shared moments, and the people around you.</p></article>
              <article><span className={styles.number}>03 / Explore</span><h3>Make room for a detour.</h3><p>From everyday outings to something new, find inspiration for your next Minnesota day.</p></article>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <span>For the Love of Minnesota</span>
          <nav aria-label="Footer">
            <Link href="/welcome" prefetch={false}>Join the community</Link>
            <Link href="/privacy" prefetch={false}>Privacy</Link>
            <Link href="/tos" prefetch={false}>Terms</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
