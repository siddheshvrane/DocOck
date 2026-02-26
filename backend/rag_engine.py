from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings
import os

class RAGEngine:
    def __init__(self, patient_id: int):
        self.patient_id = patient_id
        self.persist_directory = f"./data/vector_store/{patient_id}"
        self.embeddings = OllamaEmbeddings(model="phi3")
        self.vector_store = None

    def index_documents(self, doc_path: str):
        # Load documents
        loader = PyPDFLoader(doc_path)
        documents = loader.load()

        # Split text
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(documents)

        # Create/Update Vector Store
        self.vector_store = Chroma.from_documents(
            documents=splits,
            embedding=self.embeddings,
            persist_directory=self.persist_directory
        )
        return True

    def query(self, query_text: str, k: int = 3):
        if not self.vector_store:
            if os.path.exists(self.persist_directory):
                self.vector_store = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=self.embeddings
                )
            else:
                return []

        results = self.vector_store.similarity_search(query_text, k=k)
        return [doc.page_content for doc in results]

def process_patient_document(patient_id: int, file_path: str):
    engine = RAGEngine(patient_id)
    return engine.index_documents(file_path)
