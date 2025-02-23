import CollaborativeEditor from './components/CollaborativeEditor'

function App() {
    return (
        <div className="container mx-auto py-8 px-4">
            <CollaborativeEditor
                username={`User-${Math.floor(Math.random() * 1000)}`}
                roomId="demo-room"
            />
        </div>
    )
}

export default App
