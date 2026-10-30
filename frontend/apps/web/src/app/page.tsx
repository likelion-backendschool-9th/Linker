import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Linker</h1>
      <p className={styles.description}>초기 세팅 확인용 페이지예요.</p>
    </main>
  );
}
