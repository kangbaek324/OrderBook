import { Route, Routes } from 'react-router'
import Signin from './pages/signin'
import Signup from './pages/signup'
import Stock from './pages/stock'

function App() {
  return (
    <Routes>
      <Route path='/' element={<Stock></Stock>}></Route>
      <Route path='/signin' element={<Signin></Signin>}></Route>
      <Route path='/signup' element={<Signup></Signup>}></Route>
      <Route path='/stock' element={<Stock></Stock>}></Route>
    </Routes>
  )
}

export default App
