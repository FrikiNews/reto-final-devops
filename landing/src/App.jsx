import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Simulator from './components/Simulator';
import Pricing from './components/Pricing';
import Footer from './components/Footer';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Simulator />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
