export function Copyright() {
  return (
    <footer className='flex items-center'>
      <div className='flex flex-col text-xs text-right text-secondary-800/60 -space-y-0.5 ml-1'>
        <p>A Leximory Product</p>
        <p>With Perennial Branch</p>
      </div>
      <img src={'/logo.webp'} className='size-8 hidden sm:block opacity-75'></img>
    </footer>
  )
}