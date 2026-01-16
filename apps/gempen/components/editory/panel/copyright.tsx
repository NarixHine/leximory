export function Copyright() {
  return (
    <footer className='flex items-center border-y-1 p-2 border-secondary-800/40'>
      <div className='flex flex-col text-xs text-right text-secondary-800/60 ml-1'>
        <p>A Leximory Product</p>
        <p>With Perennial Branch</p>
      </div>
      <img src={'/logo.webp'} className='size-10 hidden sm:block opacity-80'></img>
    </footer>
  )
}